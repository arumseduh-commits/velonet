# Laporan Analisis Lengkap: Penjadwalan Waktu Ujian (Window of Availability) & Realtime Live Proctor Leaderboard

## 1. Ringkasan Eksekutif (Executive Summary)
Investigasi mendalam telah dilakukan terhadap codebase VeloNet (CBT & LMS platform) terkait:
1. **Model & Skema Database Prisma (`prisma/schema.prisma`)**: Model `Quiz`, `Question`, `Option`, `QuizAttempt`, `QuizStudentAnswer`, `ExamViolationLog`, dan `User`.
2. **Manajemen Ujian Admin (Admin Exam Management)**: Halaman pembuatan (`/admin/exams/create`), pengeditan (`/admin/exams/[quizId]/edit`), daftar ujian (`/admin/exams`), dan endpoint API (`/api/admin/exams` & `/api/admin/exams/[quizId]`).
3. **Representasi dan Alur `openAt` & `closeAt`**: Penanganan format ISO 8601 vs `datetime-local`, validasi skema, kontrol antarmuka pengguna (Date/Time Picker), serta integrasi ke API dan Runner siswa.
4. **Dashboard Realtime Live Proctor Leaderboard (`/admin/exams/[quizId]/proctor`)**: Integrasi Podium Top 3 ala Quizizz, progress bar per butir soal, filter kelas (`studentClass`), pengurutan multi-kriteria, dan kontrol pengawas (Unlock, Force Submit, Disqualify).
5. **Sinkronisasi Progress Siswa (`/api/quiz/[quizId]/progress`)**: Keterhubungan realtime antara runner siswa (`/student/quiz/[quizId]`) dan dashboard pengawas admin.

---

## 2. Analisis Skema Database Prisma (`prisma/schema.prisma`)

### 2.1. Model `Quiz`
Model `Quiz` menyimpan konfigurasi utama ujian CBT:
```prisma
model Quiz {
  id          String   @id @default(uuid())
  title       String
  description String?
  
  // Penjadwalan Rentang Waktu Ujian (Window of Availability)
  openAt      DateTime? // Waktu Mulai / Buka Ujian
  closeAt     DateTime? // Waktu Selesai / Tutup Ujian

  // Konfigurasi Keamanan & CBT
  durationMinutes        Int      @default(30)
  enableFullscreenLock   Boolean  @default(true)
  enableTabSwitchDetect  Boolean  @default(true)
  maxStrikes             Int      @default(3)
  enableCameraProctor    Boolean  @default(false)
  supervisorPin          String   @default("123456")
  shuffleQuestions       Boolean  @default(true)
  shuffleOptions         Boolean  @default(true)

  // Token Masuk & Pengaturan Hasil Ujian
  examToken              String?
  showScoreImmediately   Boolean   @default(true)
  scoreReleaseAt         DateTime?
  showDiscussion         Boolean   @default(false)

  questions   Question[]
  attempts    QuizAttempt[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```
- Kolom `openAt` dan `closeAt` bertipe `DateTime?` (opsional / nullable).
- Jika `openAt == null`, ujian tidak memiliki batas awal pembukaan (langsung dapat diakses).
- Jika `closeAt == null`, ujian tidak memiliki batas akhir penutupan (dapat diakses kapan saja).

### 2.2. Model `Question` & `Option`
```prisma
enum QuestionType {
  SINGLE_CHOICE
  CHECKBOXES
  TRUE_FALSE
  SHORT_ANSWER
  ESSAY
}

model Question {
  id            String       @id @default(uuid())
  quizId        String
  quiz          Quiz         @relation(fields: [quizId], references: [id], onDelete: Cascade)
  type          QuestionType @default(SINGLE_CHOICE)
  text          String
  imageUrl      String?      // URL gambar ilustrasi soal (terkompresi WebP)
  points        Int          @default(10)
  order         Int          @default(0)
  
  explanation   String?      // Pembahasan & penjelasan butir soal
  sampleAnswer  String?      // Kunci isian singkat / referensi essay
  gradingRubric String?      // Rubrik kata kunci untuk koreksi AI/Guru
  caseSensitive Boolean      @default(false)
  
  options       Option[]
  studentAnswers QuizStudentAnswer[]

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

model Option {
  id          String   @id @default(uuid())
  questionId  String
  question    Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  text        String
  isCorrect   Boolean  @default(false)
}
```

### 2.3. Model `QuizAttempt`, `QuizStudentAnswer`, dan `ExamViolationLog`
```prisma
model QuizAttempt {
  id          String               @id @default(uuid())
  quizId      String
  quiz        Quiz                 @relation(fields: [quizId], references: [id], onDelete: Cascade)
  userId      String
  user        User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  status      String               @default("IN_PROGRESS") // IN_PROGRESS, LOCKED, SUBMITTED, GRADED, DISQUALIFIED
  strikeCount Int                  @default(0)
  score       Float                @default(0)
  totalScore  Float                @default(0)
  
  isFullyGraded Boolean            @default(false)
  answers     String?              // JSON stringified fallback map
  
  startedAt   DateTime             @default(now())
  submittedAt DateTime?
  gradedAt    DateTime?

  detailedAnswers QuizStudentAnswer[]
  violations  ExamViolationLog[]

  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  @@index([quizId])
  @@index([userId])
}

model QuizStudentAnswer {
  id                   String      @id @default(uuid())
  attemptId            String
  attempt              QuizAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  questionId           String
  question             Question    @relation(fields: [questionId], references: [id], onDelete: Cascade)
  
  selectedOptionIds    String?     // JSON array string misal '["opt-1"]'
  textResponse         String?     // Isian teks SHORT_ANSWER atau ESSAY
  
  isAutoGraded         Boolean     @default(false)
  earnedPoints         Float       @default(0)
  
  aiSuggestedScore     Float?
  aiEvaluationFeedback String?
  
  teacherScore         Float?
  teacherFeedback      String?
  gradedByUserId       String?

  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt

  @@unique([attemptId, questionId])
}

model ExamViolationLog {
  id          String      @id @default(uuid())
  attemptId   String
  attempt     QuizAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  type        String      // TAB_SWITCH, FULLSCREEN_EXIT, DEVTOOLS, REMOTE_UNLOCKED, STRIKES_RESET, FORCE_SUBMITTED, DISQUALIFIED
  description String?
  snapshotUrl String?
  timestamp   DateTime    @default(now())

  @@index([attemptId])
}
```

### 2.4. Model `User` & Atribut Kelas/Grade
- Model `User` memiliki kolom `studentClass String?` (contoh: "X IPA 1", "Kelas Velocity #1", dll).
- Tidak ada tabel terpisah untuk Class/Grade; relasi kelas siswa didapat langsung dari `User.studentClass`.
- Untuk filter kelas pada proctor dashboard, nilai `studentClass` unik dapat diagregasikan dari daftar peserta aktif atau seluruh siswa di database.

---

## 3. Analisis Halaman & Komponen Admin Exam Management

### 3.1. Daftar Modul Ujian (`src/app/admin/exams/page.tsx`)
- Mengambil data dari `GET /api/admin/exams`.
- Menampilkan KPI Cards (Total Modul Ujian, Sedang Mengerjakan, Terkunci).
- Setiap card ujian menampilkan: Jumlah Soal, Durasi (Menit), PIN Pengawas, Badges Keamanan, dan Live Activity indicator.
- **Rekomendasi Penambahan UI**:
  - Menampilkan badge jadwal waktu (`openAt` s/d `closeAt`) dengan status visual:
    - 🟢 **Sedang Berlangsung**: `now >= openAt && now <= closeAt` (atau tanpa batas waktu).
    - 🟡 **Terjadwal (Akan Datang)**: `now < openAt`.
    - 🔴 **Telah Berakhir**: `now > closeAt`.
    - ⚪ **Fleksibel**: Tanpa pembatasan `openAt` dan `closeAt`.

### 3.2. Form Pembuatan Ujian (`src/app/admin/exams/create/page.tsx`)
- **Status Saat Ini**:
  - State lokal belum memiliki `openAt` dan `closeAt`.
  - UI belum menyediakan input datetime-local picker untuk rentang jadwal buka/tutup.
  - Handler submit (`handleSaveExam`) belum menyertakan `openAt` dan `closeAt` ke dalam payload POST `/api/admin/exams`.
- **Kebutuhan Modifikasi**:
  1. Tambahkan state `const [openAt, setOpenAt] = useState("");` dan `const [closeAt, setCloseAt] = useState("");`.
  2. Tambahkan seksi antarmuka "Jadwal Rentang Waktu Ujian (Window of Availability)" pada Card Informasi & Pengaturan Ujian:
     - Input `openAt` (`type="datetime-local"`): Jadwal Buka Ujian.
     - Input `closeAt` (`type="datetime-local"`): Jadwal Tutup Ujian.
     - Helper text informatif untuk guru/admin.
     - Quick action buttons (misal: "Buka Sekarang", "Tutup Hari Ini 23:59", "Reset / Tanpa Batas Waktu").
  3. Validasi client-side: jika `openAt` dan `closeAt` keduanya diisi, pastikan `new Date(openAt) < new Date(closeAt)`. Jika tidak valid, munculkan peringatan via `toast.warning(...)`.
  4. Kirim `openAt: openAt ? new Date(openAt).toISOString() : null` dan `closeAt: closeAt ? new Date(closeAt).toISOString() : null` pada payload POST.

### 3.3. Form Pengeditan Ujian (`src/app/admin/exams/[quizId]/edit/page.tsx`)
- **Status Saat Ini**:
  - State `openAt` dan `closeAt` belum didefinisikan.
  - Fetch existing quiz belum mengisi nilai `openAt` dan `closeAt` ke input.
  - Handler `handleSaveExam` belum mengirimkan `openAt` dan `closeAt` pada payload PATCH `/api/admin/exams/[quizId]`.
- **Kebutuhan Modifikasi**:
  1. Tambahkan state `openAt` dan `closeAt`.
  2. Pada `useEffect` saat memuat data quiz:
     ```tsx
     setOpenAt(q.openAt ? q.openAt.substring(0, 16) : "");
     setCloseAt(q.closeAt ? q.closeAt.substring(0, 16) : "");
     ```
  3. Sediakan kontrol UI pemilih tanggal & waktu yang identik dengan form create.
  4. Kirim `openAt: openAt ? new Date(openAt).toISOString() : null` dan `closeAt: closeAt ? new Date(closeAt).toISOString() : null` pada PATCH request.

---

## 4. Analisis Endpoint API Admin Exam

### 4.1. `src/app/api/admin/exams/route.ts`
- **GET Handler**:
  - Mengambil daftar ujian dari Prisma beserta relasi questions dan attempts.
  - Sudah menyertakan `openAt: q.openAt ? q.openAt.toISOString() : null` dan `closeAt: q.closeAt ? q.closeAt.toISOString() : null`.
- **POST Handler**:
  - Menerima `openAt` dan `closeAt` dari request body.
  - Melakukan validasi tanggal:
    - Cek `isNaN(parsedOpenAt.getTime())` dan `isNaN(parsedCloseAt.getTime())`.
    - Cek `parsedOpenAt >= parsedCloseAt` -> mengembalikan response 400 Bad Request jika waktu tutup mendahului waktu buka.
  - Menyimpan `openAt: parsedOpenAt` dan `closeAt: parsedCloseAt` ke model `Quiz`.

### 4.2. `src/app/api/admin/exams/[quizId]/route.ts`
- **GET Handler**:
  - Mengembalikan detail modul ujian lengkap dengan questions, options, dan attempts.
- **PATCH Handler**:
  - Menerima `openAt` dan `closeAt` dari request body.
  - Melakukan validasi konsistensi tanggal terhadap nilai eksisting / baru.
  - Memperbarui data `Quiz` di database PostgreSQL.
- **DELETE Handler**:
  - Menghapus modul ujian berserta seluruh cascading relation.

### 4.3. `src/app/api/admin/exams/[quizId]/proctor/route.ts` & `/action/route.ts`
- Mengambil seluruh peserta ujian untuk kuis tertentu, menghitung `answeredCount`, `totalQuestions`, `progressPercentage`, `strikeCount`, `score`, dan daftar pelanggaran terakhir.
- Endpoint `/action` mendukung aksi pengawas:
  - `UNLOCK`: Mengembalikan status ke `IN_PROGRESS`, mereset `strikeCount` ke 0, dan mencatat log `REMOTE_UNLOCKED`.
  - `RESET_STRIKES`: Mereset `strikeCount` ke 0 dan mencatat log `STRIKES_RESET`.
  - `FORCE_SUBMIT`: Menghitung skor dari jawaban tersimpan, menyetel status `SUBMITTED`, dan mencatat log `FORCE_SUBMITTED`.
  - `DISQUALIFY`: Menyetel status `DISQUALIFIED`, menyetel skor ke 0, dan mencatat log `DISQUALIFIED`.

---

## 5. Analisis Dashboard Realtime Live Proctor & Gamified Leaderboard (`/admin/exams/[quizId]/proctor/page.tsx`)

Berdasarkan Requirement R2, halaman Pengawas Ujian perlu diperkaya dengan:

1. **Polling Realtime Dinamis**:
   - Interval polling setiap 3.0 - 3.5 detik dengan smooth transition indikator live.
2. **Podium Gamifikasi Top 3 (Ala Quizizz)**:
   - Visualisasi podium 3 besar (Juara 1: Medali Emas, Juara 2: Medali Perak, Juara 3: Medali Perunggu).
   - Efek animasi peringkat dinamis (peringkat bergerak naik/turun sesuai pertambahan skor realtime siswa).
   - Menampilkan Nama Siswa, Kelas, Skor Poin saat ini, dan Persentase Pengerjaan.
3. **Daftar Peserta Live & Fitur Monitoring Rinci**:
   - **Progress Bar Terjawab**: Visualisasi persentase soal terselesaikan (misal: 15/20 soal, 75%) dengan progress bar bertingkat (emerald/blue).
   - **Skor Realtime**: Poin langsung ter-update saat siswa menjawab benar.
   - **Status Koneksi & Pengerjaan**:
     - 🟢 *Mengerjakan* (`IN_PROGRESS`)
     - 🔵 *Selesai Dikumpulkan* (`SUBMITTED` / `GRADED`)
     - 🔴 *Terkunci Pelanggaran* (`LOCKED`)
     - ⚫ *Didiskualifikasi* (`DISQUALIFIED`)
   - **Indikator Strike**: Badge warna kuning untuk 1-2 strike, merah menyala (pulse) untuk 3 strike.
4. **Tombol Kontrol Pengawas Cepat**:
   - Buka Kunci (Unlock)
   - Kumpulkan Paksa (Force Submit)
   - Diskualifikasi (Disqualify / Kick)
   - Seluruh aksi diamankan dengan modal konfirmasi custom `useDialog` (tanpa browser `confirm()`).
5. **Filter & Pengurutan Canggih**:
   - Filter berdasarkan Kelas Siswa (`User.studentClass`) dan Status Pengerjaan.
   - Pengurutan berdasarkan:
     - Skor Tertinggi (Rank Leaderboard)
     - Progres Tercepat / Paling Banyak Selesai
     - Pelanggaran Terbanyak (Strikes)
     - Nama Siswa (A-Z)

---

## 6. Analisis Alur Runner Siswa Terkait Window of Availability & Progress Sync

### 6.1. Aturan Validasi Window of Availability pada Runner Siswa
1. **Siswa Mengakses Sebelum `openAt` (`now < openAt`)**:
   - `/api/quiz/[quizId]/start` dan `/api/student/exams` menolak akses dengan response status `UPCOMING`.
   - Tampilan siswa menampilkan banner hitung mundur (countdown) menuju waktu `openAt` dan tombol masuk ujian dinonaktifkan.
2. **Siswa Mengakses Setelah `closeAt` (`now > closeAt`)**:
   - Jika siswa **belum pernah memulai** ujian (`!attempt || !attempt.startedAt`), akses ditolak permanen dengan status `CLOSED` ("Ujian Telah Ditutup / Berakhir").
   - Jika siswa **sudah memulai sebelum `closeAt`** dan statusnya masih `IN_PROGRESS`, siswa diberikan dispensasi untuk menyelesaikan sisa durasi timer pribadinya (`durationMinutes` dihitung dari `startedAt`).

### 6.2. Sinkronisasi Progress Cepat (`/api/quiz/[quizId]/progress`)
- Endpoint `/api/quiz/[quizId]/progress` telah mendukung sinkronisasi 3 tingkat:
  1. **Level 1**: Backup state lengkap ke `QuizAttempt.answers` (JSON Map).
  2. **Level 2**: Upsert butir jawaban ke `QuizStudentAnswer` (mencatat pilihan opsi / isian teks dan langsung menghitung poin otomatis untuk PG/TF/Checkboxes).
  3. **Level 3**: Agregasi total skor realtime ke `QuizAttempt.score` sehingga langsung terbaca oleh live proctor dashboard.
- Di runner siswa (`src/app/student/quiz/[quizId]/page.tsx`), pemanggilan API progress dipicu secara non-blocking di background setiap kali siswa memilih/mengubah opsi jawaban.

---

## 7. Rekomendasi Rencana Implementasi

| Komponen / File | Rencana Perubahan |
|---|---|
| `src/app/admin/exams/create/page.tsx` | Tambahkan state `openAt` & `closeAt`, input form `datetime-local`, validasi tanggal, dan kirim payload ke POST API. |
| `src/app/admin/exams/[quizId]/edit/page.tsx` | Tambahkan state `openAt` & `closeAt`, prefill data eksisting, input form `datetime-local`, validasi tanggal, dan kirim payload ke PATCH API. |
| `src/app/admin/exams/page.tsx` | Tampilkan status badge jadwal window availability (`openAt` - `closeAt`) pada setiap card ujian. |
| `src/app/admin/exams/[quizId]/proctor/page.tsx` | Implementasikan Gamified Top 3 Podium ala Quizizz, progress bar per butir soal, filter kelas, sorting dinamis, dan live indicators. |
| `src/app/student/exams/page.tsx` & `src/app/student/quiz/[quizId]/page.tsx` | Pastikan countdown sebelum `openAt`, pemblokiran setelah `closeAt`, dan toleransi timer personal jika mulai sebelum `closeAt`. |
| `src/app/student/quiz/[quizId]/page.tsx` | Pastikan pemanggilan background progress sync `/api/quiz/[quizId]/progress` berjalan lancar saat pemilihan jawaban. |

Semua perubahan mematuhi Aturan Mutlak VeloNet:
- 100% responsif mobile (`< 640px`) & desktop.
- Menggunakan Custom UI Dialog System (`useDialog` dari `@/components/ui/DialogProvider`) tanpa `alert()` / `confirm()` native.
- Tipe data TypeScript 100% valid dan lolos `next build`.
