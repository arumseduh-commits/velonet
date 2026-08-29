# Laporan Investigasi Komprehensif: Skema Database, Admin API, Student Quiz Runner, Fast Progress Sync & Live Proctoring

**Tanggal Investigasi**: 2026-08-30  
**Lokasi Kerja**: `c:\UBIG\VeloNet\.agents\explorer_schema_api`  
**Target Proyek**: Sistem CBT VeloNet (`c:\UBIG\VeloNet`)  
**Peneliti**: Explorer 1 (Schema & API Specialist)

---

## 1. Ringkasan Eksekutif & Ruang Lingkup

Investigasi ini menganalisis arsitektur skema database Prisma, REST API Admin & Siswa, mekanisme sinkronisasi progres ujian pengerjaan real-time (*Fast Progress Sync*), dan sistem pemantauan pengawas *Live Proctor Leaderboard* interaktif ala Quizizz untuk sistem CBT VeloNet.

Laporan ini memetakan secara presisi:
1. **Perubahan Skema Prisma (`prisma/schema.prisma`)**: Penambahan field `openAt` dan `closeAt` pada model `Quiz`.
2. **API Admin Ujian (`/api/admin/exams` & `/api/admin/exams/[quizId]`)**: Integrasi validasi data dan penyimpanan rentang waktu buka-tutup ujian.
3. **API Siswa & Runner Ujian (`/api/student/exams`, `/api/quiz/[quizId]`, `/api/quiz/[quizId]/start`)**: Validasi *Window of Availability*, hitung mundur pra-buka, proteksi penutupan, serta toleransi timer pribadi siswa.
4. **Desain Arsitektur *Fast Progress Sync* (`/api/quiz/[quizId]/progress`)**: Sinkronisasi jawaban seketika di latar belakang tanpa menimbulkan *database contention* atau memblokir pengerjaan siswa.
5. **API & Dashboard Realtime Live Proctor Leaderboard (`/api/admin/exams/[quizId]/proctor` & `/api/admin/exams/[quizId]/action`)**: Penyajian data polling 3 detik, kalkulasi peringkat gamifikasi podium Top 3 dinamis, indikator progres butir soal, status pelanggaran strike, dan aksi pengawas cepat (*Unlock*, *Force Submit*, *Disqualify*).

---

## 2. Investigasi Skema Database Prisma (`prisma/schema.prisma`)

### 2.1 Model Terkait & Relasi

Berdasarkan pemeriksaan langsung pada `prisma/schema.prisma`:
- **`model Quiz` (Baris 298–324)**:
  - Menyimpan meta konfigurasi ujian (`title`, `description`, `durationMinutes`, `enableFullscreenLock`, `enableTabSwitchDetect`, `maxStrikes`, `enableCameraProctor`, `supervisorPin`, `shuffleQuestions`, `shuffleOptions`, `examToken`, `showScoreImmediately`, `scoreReleaseAt`, `showDiscussion`).
  - Relasi: `questions Question[]`, `attempts QuizAttempt[]`.
  - **Temuan**: Saat ini **belum memiliki** kolom `openAt` dan `closeAt`.
- **`model Question` (Baris 326–347)** & **`model Option` (Baris 349–355)**:
  - Memiliki tipe soal (`SINGLE_CHOICE`, `CHECKBOXES`, `TRUE_FALSE`, `SHORT_ANSWER`, `ESSAY`), `points`, `order`, `explanation`, `sampleAnswer`, `gradingRubric`, `caseSensitive`.
- **`model QuizAttempt` (Baris 358–385)**:
  - Menyimpan sesi pengerjaan siswa (`id`, `quizId`, `userId`, `status`, `strikeCount`, `score`, `totalScore`, `isFullyGraded`, `answers` [JSON fallback], `startedAt`, `submittedAt`, `gradedAt`).
  - Relasi: `detailedAnswers QuizStudentAnswer[]`, `violations ExamViolationLog[]`, `quiz Quiz`, `user User`.
  - Indeks: `@@index([quizId])`, `@@index([userId])`.
- **`model QuizStudentAnswer` (Baris 387–413)**:
  - Menyimpan detail jawaban per butir soal (`attemptId`, `questionId`, `selectedOptionIds`, `textResponse`, `isAutoGraded`, `earnedPoints`, `aiSuggestedScore`, `aiEvaluationFeedback`, `teacherScore`, `teacherFeedback`).
  - Memiliki konstrain unik: `@@unique([attemptId, questionId])`.
- **`model User` (Baris 16–49)**:
  - Memiliki `id`, `phoneNumber`, `name`, `role`, `studentClass String?` (kelas siswa), dan relasi `quizAttempts QuizAttempt[]`.

### 2.2 Perubahan Skema yang Diperlukan

Tambahkan dua field tanggal baru pada `model Quiz`:
```prisma
model Quiz {
  id                     String    @id @default(uuid())
  title                  String
  description            String?
  
  // Penjadwalan Rentang Waktu Ujian (Window of Availability)
  openAt                 DateTime? // Waktu Mulai / Buka Ujian
  closeAt                DateTime? // Waktu Selesai / Tutup Ujian

  // Konfigurasi Keamanan & CBT
  durationMinutes        Int       @default(30)
  enableFullscreenLock   Boolean   @default(true)
  enableTabSwitchDetect  Boolean   @default(true)
  maxStrikes             Int       @default(3)
  enableCameraProctor    Boolean   @default(false)
  supervisorPin          String    @default("123456")
  shuffleQuestions       Boolean   @default(true)
  shuffleOptions         Boolean   @default(true)

  // Token Masuk & Pengaturan Hasil Ujian
  examToken              String?
  showScoreImmediately   Boolean   @default(true)
  scoreReleaseAt         DateTime?
  showDiscussion         Boolean   @default(false)

  questions   Question[]
  attempts    QuizAttempt[]

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

**Sinkronisasi ke Database**:
Dijalankan menggunakan:
```powershell
npx prisma db push
```

---

## 3. Investigasi API Admin Ujian (`/api/admin/exams`)

### 3.1 `src/app/api/admin/exams/route.ts`
- **GET Handler (Baris 5–61)**:
  - Mengambil seluruh ujian beserta `questions` dan `attempts`.
  - Format pengembalian objek saat ini belum memasukkan `openAt` dan `closeAt`.
  - **Perbaikan**: Tambahkan `openAt: q.openAt ? q.openAt.toISOString() : null` dan `closeAt: q.closeAt ? q.closeAt.toISOString() : null` pada response JSON.
- **POST Handler (Baris 63–151)**:
  - Menerima request body JSON.
  - Saat ini mengekstrak field konfigurasi ujian.
  - **Perbaikan**: Ekstrak `openAt` dan `closeAt`:
    ```ts
    const {
      title,
      description,
      openAt = null,
      closeAt = null,
      durationMinutes = 30,
      // ...
    } = body;
    ```
  - Validasi: Pastikan jika kedua nilai diisi, `new Date(openAt) < new Date(closeAt)`.
  - Simpan ke prisma:
    ```ts
    openAt: openAt ? new Date(openAt) : null,
    closeAt: closeAt ? new Date(closeAt) : null,
    ```

### 3.2 `src/app/api/admin/exams/[quizId]/route.ts`
- **GET Handler (Baris 5–49)**:
  - Mengambil quiz by ID. Otomatis menyertakan seluruh kolom `Quiz` (termasuk `openAt` dan `closeAt` setelah Prisma generate).
- **PATCH Handler (Baris 51–170)**:
  - Menerima body update.
  - **Perbaikan**: Tambahkan update opsional untuk `openAt` dan `closeAt`:
    ```ts
    ...(openAt !== undefined && { openAt: openAt ? new Date(openAt) : null }),
    ...(closeAt !== undefined && { closeAt: closeAt ? new Date(closeAt) : null }),
    ```
- **DELETE Handler (Baris 172–204)**:
  - Menghapus modul ujian beserta cascading delete ke pertanyaan dan attempt.

---

## 4. Investigasi API Siswa & Runner Ujian

### 4.1 `src/app/api/student/exams/route.ts`
- **Tujuan**: Menampilkan daftar modul ujian CBT untuk siswa di `/student/exams`.
- **Temuan Saat Ini**:
  - Mengambil ujian beserta attempt terakhir milik siswa yang sedang login.
  - Belum mengembalikan `openAt` dan `closeAt`.
- **Perbaikan & Logika Status Akses**:
  - Sertakan `openAt` dan `closeAt` pada return object.
  - Hitung status ketersediaan (*availability status*):
    ```ts
    const now = new Date();
    const isOpenSchedule = (!q.openAt || now >= new Date(q.openAt));
    const isClosedSchedule = (q.closeAt && now > new Date(q.closeAt));
    
    // Status pengerjaan
    const hasAttempt = Boolean(latestAttempt);
    const isStartedBeforeClose = hasAttempt && latestAttempt.startedAt;
    
    let availability = "OPEN"; // "UPCOMING" | "OPEN" | "CLOSED"
    if (q.openAt && now < new Date(q.openAt)) {
      availability = "UPCOMING";
    } else if (isClosedSchedule && !isStartedBeforeClose) {
      availability = "CLOSED";
    }
    ```
  - Kirimkan `availability`, `openAt`, `closeAt` agar UI dapat merender badge "Belum Dibuka (Hitung Mundur)", "Tersedia", atau "Telah Ditutup".

### 4.2 `src/app/api/quiz/[quizId]/route.ts`
- Mengambil detail ujian dan status sesi siswa.
- Perlu menyertakan `openAt` dan `closeAt` pada objek `sanitizedQuiz`.

### 4.3 `src/app/api/quiz/[quizId]/start/route.ts`
- **Tujuan**: Memulai sesi ujian siswa (membuat `QuizAttempt` baru jika belum ada, atau mengambil yang sudah ada).
- **Logika Penjadwalan Wajib**:
  1. Jika Admin (Preview mode) $\rightarrow$ loloskan (preview attempt).
  2. Periksa `quiz.openAt`:
     - Jika `now < new Date(quiz.openAt)`: Tolak dengan status 403:
       ```json
       {
         "success": false,
         "error": "Ujian belum dibuka. Ujian akan dibuka pada tanggal ...",
         "openAt": quiz.openAt
       }
       ```
  3. Periksa `quiz.closeAt`:
     - Cari apakah siswa sudah memiliki attempt `IN_PROGRESS` sebelumnya (`startedAt < closeAt`).
     - Jika belum pernah mulai dan `now > new Date(quiz.closeAt)`: Tolak dengan status 403:
       ```json
       {
         "success": false,
         "error": "Waktu pengerjaan ujian telah berakhir / ditutup."
       }
       ```
     - Jika siswa sudah memulai sebelum `closeAt`, izinkan siswa melanjutkan pengerjaan dengan timer personal yang tersisa.
  4. Perhitungan Timer Personal:
     - Waktu sisa siswa dihitung dari:
       $$\text{Sisa Detik} = (\text{durationMinutes} \times 60) - \left\lfloor \frac{\text{now} - \text{startedAt}}{1000} \right\rfloor$$
     - Siswa mendapatkan hak menyelesaikan sisa durasi personalnya selama status attempt masih `IN_PROGRESS`.

---

## 5. Desain Arsitektur *Fast Progress Sync* (`/api/quiz/[quizId]/progress`)

### 5.1 Latar Belakang & Masalah
Saat siswa mengerjakan ujian CBT (misal 50 butir soal), jika siswa memilih jawaban A, beralih soal, atau mengetik essay, progres harus tersimpan secara *seamless* di database tanpa:
- Membebani koneksi database (*database contention* dari ratusan siswa simultan).
- Mengganggu kecepatan render UI runner siswa (*non-blocking*).
- Menghilangkan jawaban jika terjadi mati lampu, tab browser tertutup, atau reload mendadak.
- Menunda pembaruan skor live di dashboard pengawas (*Live Proctoring Leaderboard*).

### 5.2 Rute Endpoint: `POST /api/quiz/[quizId]/progress`

**Struktur Payload Request**:
```json
{
  "questionId": "q_abc_123",
  "optionId": "opt_xyz_456",
  "selectedOptionIds": ["opt_xyz_456"],
  "textResponse": null,
  "answersMap": {
    "q_abc_123": { "optionId": "opt_xyz_456" }
  }
}
```

**Alur Eksekusi Efisien di Backend**:
1. **Autentikasi Cepat**: Verifikasi session siswa (`getLoggedInStudent()`).
2. **Ambil Attempt Aktif**: Ambil `QuizAttempt` (`where: { quizId, userId: student.id, status: "IN_PROGRESS" }`).
   - Jika status `LOCKED`, `SUBMITTED`, atau `DISQUALIFIED`, tolak sync dengan instruksi status terkini.
3. **Penyimpanan Ganda yang Cepat (Atomic)**:
   - **Level 1 (Full State Backup)**: Simpan seluruh `answersMap` ke dalam kolom `QuizAttempt.answers` (JSON string) agar pemulihan instan saat reload halaman.
   - **Level 2 (Granular Student Answer)**: Lakukan `upsert` pada `QuizStudentAnswer` untuk `questionId` yang sedang dijawab:
     - Nilai otomatis dihitung secara instan (untuk `SINGLE_CHOICE`, `TRUE_FALSE`, `CHECKBOXES`) berdasarkan data opsi benar.
   - **Level 3 (Realtime Score Aggregation)**:
     - Hitung ulang total `earnedPoints` dari `QuizStudentAnswer` untuk attempt ini dan perbarui `QuizAttempt.score`.
     - Ini membuat *Live Proctor Leaderboard* selalu memiliki skor terkini tiap kali siswa menjawab benar.
4. **Optimasi Anti-Contention**:
   - Menggunakan query terfokus `prisma.quizStudentAnswer.upsert()` yang memanfaatkan indeks unik bawaan `@@unique([attemptId, questionId])`.
   - Waktu respons < 25ms.
   - Client mengaplikasikan *debounce* (misal 400ms - 800ms) untuk input teks esai, dan kirim instan saat klik radio button pilihan ganda.

---

## 6. Investigasi Realtime Live Proctor & Gamified Leaderboard

### 6.1 Endpoint Pengawas Saat Ini:
- `GET /api/admin/exams/[quizId]/proctor`:
  - Mengambil data quiz, total pertanyaan, statistik ringkasan, dan daftar attempt peserta beserta 5 log pelanggaran terakhir.
- `POST /api/admin/exams/[quizId]/action`:
  - Menerima aksi pengawas untuk peserta tertentu (`attemptId`):
    - `UNLOCK`: Mengubah status menjadi `IN_PROGRESS`, mereset `strikeCount` ke 0, dan mencatat log `REMOTE_UNLOCKED`.
    - `RESET_STRIKES`: Mereset `strikeCount` ke 0 dan mencatat log `STRIKES_RESET`.
    - `FORCE_SUBMIT`: Menghitung skor dari jawaban tersimpan, mengubah status menjadi `SUBMITTED`, mengisi `submittedAt`, dan mencatat log `FORCE_SUBMITTED`.
    - `DISQUALIFY`: Mengubah status menjadi `DISQUALIFIED`, skor 0, dan mencatat log `DISQUALIFIED`.

### 6.2 Kebutuhan Peningkatan Endpoint `/api/admin/exams/[quizId]/proctor`:
Untuk mendukung tampilan ala Quizizz yang interaktif dan kaya data, response `GET` perlu diperkaya dengan:
1. **Per Siswa**:
   - `answeredCount`: Jumlah soal yang sudah dijawab (dari total soal).
   - `progressPercentage`: Persentase pengerjaan (misal $\frac{\text{answered}}{\text{total}} \times 100\%$).
   - `currentScore`: Skor poin realtime yang bertambah setiap kali progres disinkronkan.
   - `strikeCount`: Jumlah strike (0, 1, 2, 3).
   - `status`: `IN_PROGRESS`, `LOCKED`, `SUBMITTED`, `DISQUALIFIED`.
   - `lastActive`: Timestamp `updatedAt` untuk mendeteksi keaktifan.
2. **Peringkat Gamifikasi Realtime**:
   - Urutan peserta dihitung berdasarkan:
     1. Skor tertinggi (`score` desc).
     2. Waktu selesai tercepat (`submittedAt` asc / `startedAt` asc).
   - Penentuan Top 3 Podium (Juara 1 Emas, Juara 2 Perak, Juara 3 Perunggu).

### 6.3 Desain Halaman Pengawas (`/admin/exams/[quizId]/proctor`):
- **Polling Interval**: Fetch data setiap 3 detik secara background tanpa flickering.
- **Podium Top 3 Bergerak Dinamis**:
  - Animasi transisi naik-turun peringkat saat nilai siswa berubah secara live.
  - Kartu podium bermahkota untuk Top 1 (Emas), Top 2 (Perak), Top 3 (Perunggu).
- **Tabel Live Peserta Terintegrasi**:
  - Bar progres pengerjaan soal dengan warna gradien.
  - Angka poin realtime besar font mono.
  - Indikator visual Strike Pelanggaran:
    - 0 Strike: Netral / Bersih (Hijau/Abu).
    - 1–2 Strike: Badge Kuning (Peringatan).
    - 3 Strike: Badge Merah Berkedip (Terkunci/Diskualifikasi).
  - Tombol aksi pengawas cepat per baris:
    - *Buka Kunci (Unlock)* $\rightarrow$ Dialog konfirmasi `useDialog`.
    - *Paksa Kumpulkan (Force Submit)* $\rightarrow$ Dialog konfirmasi `useDialog`.
    - *Diskualifikasi (Kick)* $\rightarrow$ Dialog konfirmasi bahaya `useDialog`.
- **Fitur Filter & Sorting**:
  - Filter berdasarkan Kelas Siswa (`studentClass`).
  - Filter berdasarkan Status (`ALL`, `IN_PROGRESS`, `LOCKED`, `SUBMITTED`, `DISQUALIFIED`).
  - Pengurutan: Skor Tertinggi, Paling Cepat Selesai, atau Pelanggaran Terbanyak.
- **Kepatuhan UI & Mobile**:
  - 100% responsif mobile (`< 640px`) dengan `overflow-x-auto` pada tabel dan kartu podium yang dapat menyesuaikan layar.
  - Seluruh konfirmasi aksi menggunakan `useDialog()` dari `@/components/ui/DialogProvider`.

---

## 7. Actionable Implementation Checklist & Roadmap

| Modul / Komponen | File Target | Rencana Perubahan |
|---|---|---|
| **Database Schema** | `prisma/schema.prisma` | Tambahkan `openAt DateTime?` dan `closeAt DateTime?` pada `model Quiz`. Jalankan `npx prisma db push`. |
| **Admin Exam API** | `src/app/api/admin/exams/route.ts` | Tambahkan field `openAt` dan `closeAt` pada `GET` & `POST` handler dengan parsing date ISO. |
| **Admin Exam Detail API** | `src/app/api/admin/exams/[quizId]/route.ts` | Tambahkan update `openAt` dan `closeAt` pada `PATCH` handler. |
| **Admin Exam UI (Create & Edit)** | `src/app/admin/exams/create/page.tsx`<br>`src/app/admin/exams/[quizId]/edit/page.tsx` | Tambahkan input `datetime-local` untuk `openAt` (Jadwal Buka) & `closeAt` (Jadwal Tutup). Kirim nilainya ke payload POST/PATCH. |
| **Student Exams API** | `src/app/api/student/exams/route.ts` | Kirimkan `openAt`, `closeAt`, dan hitung `availabilityStatus` ("UPCOMING", "OPEN", "CLOSED"). |
| **Student Exam List UI** | `src/app/student/exams/page.tsx` | Tampilkan jadwal buka-tutup, hitung mundur (countdown) jika belum buka, dan nonaktifkan tombol mulai jika sudah lewat jadwal tutup. |
| **Student Quiz Detail & Start API** | `src/app/api/quiz/[quizId]/route.ts`<br>`src/app/api/quiz/[quizId]/start/route.ts` | Validasi rentang waktu buka-tutup, hitung sisa durasi personal siswa, cegah akses di luar jadwal. |
| **Fast Progress Sync API** | `src/app/api/quiz/[quizId]/progress/route.ts` | **(Endpoint Baru)** Menerima jawaban soal, menyimpan ke DB, menghitung skor sementara secara realtime. |
| **Student Quiz Runner UI** | `src/app/student/quiz/[quizId]/page.tsx` | Integrasikan pemanggilan background sync ke `/api/quiz/[quizId]/progress` setiap ada perubahan jawaban. |
| **Live Proctor API** | `src/app/api/admin/exams/[quizId]/proctor/route.ts` | Hitung `answeredCount`, `progressPercentage`, serta urutan peringkat live secara dinamis. |
| **Live Proctor Dashboard UI** | `src/app/admin/exams/[quizId]/proctor/page.tsx` | Polling 3 detik, Podium Top 3 Gamifikasi ala Quizizz dengan animasi naik-turun, progress bar live, indikator strike warna, filter kelas, tombol aksi aman via `useDialog`. |

---

## 8. Verifikasi & Pengujian

1. **Database Push**:
   ```powershell
   npx prisma db push
   ```
2. **Type-Check & Build**:
   ```powershell
   npm run build
   ```
3. **Verifikasi Fungsional**:
   - Jadwal buka di masa depan $\rightarrow$ Siswa melihat countdown dan dilarang masuk.
   - Jadwal tutup telah lewat $\rightarrow$ Siswa yang belum mulai dilarang masuk; siswa yang sedang aktif tetap bisa menyelesaikan sisa durasi personalnya.
   - Pengawas di `/admin/exams/[quizId]/proctor` melihat perubahan skor dan pergeseran podium secara live tiap 3 detik saat siswa mengerjakan.
   - Aksi pengawas (Unlock, Force Submit, Disqualify) berjalan mulus dengan konfirmasi `useDialog`.
