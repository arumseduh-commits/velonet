# Laporan Investigasi UI & Quiz Runner VeloNet CBT
**Explorer 2: UI, Student Exams, Quiz Runner & Proctoring Integration**
**Date:** 2026-08-30
**Working Directory:** `c:\UBIG\VeloNet\.agents\explorer_ui_runner`

---

## 1. Executive Summary

Investigasi mendalam telah dilakukan terhadap arsitektur UI/UX dan alur data ujian CBT pada aplikasi VeloNet. Fokus analisis mencakup:
1. **Admin Exam Create & Edit Pages** (`/admin/exams/create`, `/admin/exams/[quizId]/edit`, dan API pendukung) untuk penambahan konfigurasi rentang waktu buka & tutup ujian (`openAt` & `closeAt`).
2. **Student Exams Page** (`/student/exams` dan `/api/student/exams`) untuk perenderan status jendela ujian ("Ujian Belum Dibuka" dengan live countdown, "Sedang Berlangsung", dan "Ujian Telah Ditutup / Berakhir").
3. **Student Quiz Runner** (`/student/quiz/[quizId]` dan `/api/quiz/...`) untuk penegakan batas waktu akses, toleransi durasi pengerjaan siswa yang sudah mulai sebelum waktu tutup, serta integrasi sinkronisasi progres jawaban cepat di background (`/api/quiz/[quizId]/progress`).
4. **Kepatuhan Terhadap Standar AGENTS.md**: Verifikasi sistem dialog kustom (`useDialog`), penataan antarmuka responsif mobile (< 640px), ketiadaan native browser popup (`alert/confirm/prompt`), serta aturan webcam proctoring default non-aktif (`@default(false)`).

---

## 2. Analisis & Rencana Admin Exam Create & Edit (`/admin/exams/create` & `/admin/exams/[quizId]/edit`)

### 2.1 Kondisi Saat Ini (As-Is)
- **Komponen Date/Time Picker**:
  Halaman admin saat ini menggunakan input HTML5 standar `<input type="datetime-local" ... />` dengan kelas Tailwind CSS terstandarisasi untuk pengaturan waktu (contohnya pada `scoreReleaseAt` di baris 691 `create/page.tsx` dan baris 758 `[quizId]/edit/page.tsx`).
- **Format State & Serialisasi**:
  - State format lokal: String ISO terpotong `YYYY-MM-DDTHH:mm` (`.substring(0, 16)`).
  - Serialisasi payload API: `scoreReleaseAt ? new Date(scoreReleaseAt).toISOString() : null`.
- **Status Kolom `openAt` & `closeAt`**:
  - Model `Quiz` di `prisma/schema.prisma` belum memiliki kolom `openAt DateTime?` dan `closeAt DateTime?`.
  - Halaman `create/page.tsx` dan `[quizId]/edit/page.tsx` belum menyediakan state dan input UI untuk `openAt` dan `closeAt`.
  - API Handler `/api/admin/exams` (POST) dan `/api/admin/exams/[quizId]` (PATCH & GET) belum menangani `openAt` dan `closeAt`.

### 2.2 Rencana Implementasi & Penempatan Komponen (To-Be)

#### A. Penambahan State di Form Admin:
```typescript
const [openAt, setOpenAt] = useState<string>("");
const [closeAt, setCloseAt] = useState<string>("");
```
Pada saat fetch di `[quizId]/edit/page.tsx`:
```typescript
setOpenAt(q.openAt ? q.openAt.substring(0, 16) : "");
setCloseAt(q.closeAt ? q.closeAt.substring(0, 16) : "");
```

#### B. Desain UI Komponen Pemilih Rentang Waktu (Window of Availability):
Ditempatkan di dalam kartu konfigurasi ujian (`Informasi & Pengaturan Ujian`), di bawah input Durasi & PIN:
```tsx
{/* Jadwal Rentang Waktu Ujian (Window of Availability) */}
<div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3 sm:col-span-2">
  <div className="flex items-center justify-between">
    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
      <Clock className="w-4 h-4 text-blue-600" />
      <span>Jadwal Rentang Waktu Ujian (Window of Availability)</span>
    </span>
    <span className="text-[10px] text-slate-400">
      Opsional (Kosongkan jika ujian bersifat fleksibel / selalu terbuka)
    </span>
  </div>

  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-700 block">
        Jadwal Buka Ujian (Open At)
      </label>
      <input
        type="datetime-local"
        value={openAt}
        onChange={(e) => setOpenAt(e.target.value)}
        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-300 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="text-[10px] text-slate-500">
        Siswa tidak dapat memulai ujian sebelum tanggal & jam ini.
      </p>
    </div>

    <div className="space-y-1">
      <label className="text-xs font-bold text-slate-700 block">
        Jadwal Tutup Ujian (Close At)
      </label>
      <input
        type="datetime-local"
        value={closeAt}
        onChange={(e) => setCloseAt(e.target.value)}
        className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-300 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <p className="text-[10px] text-slate-500">
        Batas akhir siswa untuk mulai membuka sesi ujian.
      </p>
    </div>
  </div>
</div>
```

#### C. Payload Pengiriman ke API:
```typescript
const payload = {
  // ... field lainnya
  openAt: openAt ? new Date(openAt).toISOString() : null,
  closeAt: closeAt ? new Date(closeAt).toISOString() : null,
};
```

#### D. Penyesuaian API Admin:
- `src/app/api/admin/exams/route.ts` (POST & GET):
  - POST: Destrukturisasi `openAt, closeAt`, simpan sebagai `DateTime?` (`new Date(openAt)` / `null`).
  - GET: Sertakan `openAt: q.openAt, closeAt: q.closeAt` dalam kembalian data.
- `src/app/api/admin/exams/[quizId]/route.ts` (PATCH & GET):
  - PATCH: Update `openAt` dan `closeAt` jika didefinisikan dalam payload.

#### E. Tampilan pada Daftar Ujian Admin (`/admin/exams`):
Kartu modul ujian pada `src/app/admin/exams/page.tsx` diperkaya dengan badge jadwal rentang waktu:
- Jika ada `openAt` dan `closeAt`: menampilkan ikon kalender dan format rentang waktu (misal `30 Agu 08:00 - 12:00 WIB`).
- Jika waktu sekarang `< openAt`: badge status `Jadwal Mendatang`.
- Jika waktu sekarang `> closeAt`: badge status `Sesi Berakhir`.
- Jika berada dalam rentang: badge status hijau `Sesi Buka`.

---

## 3. Analisis & Rencana Student Exams Page (`/student/exams`)

### 3.1 Kondisi Saat Ini (As-Is)
- Halaman `src/app/student/exams/page.tsx` menerima daftar ujian dari `/api/student/exams`.
- Kartu ujian saat ini menampilkan badge status pengerjaan attempt: `Didiskualifikasi`, `Selesai Dikerjakan`, `Terkunci Pelanggaran`, `Sedang Dikerjakan`, atau `Belum Dikerjakan`.
- Tombol aksi mengarahkan siswa ke `/student/quiz/${exam.id}` dengan label dinamis ("Lihat Hasil Ujian", "Lanjutkan Ujian", "Ikuti Ujian", dll.).
- Belum ada logika pemblokiran kartu berdasarkan jadwal `openAt` atau `closeAt`, dan belum ada hitung mundur (countdown).

### 3.2 Logika Status Jendela Waktu & Komponen Countdown (To-Be)

#### A. Status State Perhitungan Waktu Real-Time:
Perlu ada state `const [currentTime, setCurrentTime] = useState(Date.now());` dengan interval tick tiap 1 detik di `src/app/student/exams/page.tsx` agar hitung mundur berjalan mulus.

Untuk setiap `exam`:
```typescript
const now = new Date(currentTime);
const openDate = exam.openAt ? new Date(exam.openAt) : null;
const closeDate = exam.closeAt ? new Date(exam.closeAt) : null;
const hasAttempt = Boolean(exam.attempt);
const isAttemptCompleted = exam.attempt?.status === "SUBMITTED" || exam.attempt?.status === "GRADED" || exam.attempt?.status === "DISQUALIFIED";
const isAttemptInProgress = exam.attempt?.status === "IN_PROGRESS" || exam.attempt?.status === "LOCKED";

const isNotYetOpen = openDate ? now < openDate : false;
const isClosed = closeDate ? now > closeDate : false;
```

#### B. Matriks Status, Badge, & Tombol Aksi:

| Skenario | Kondisi | Badge Tampilan | Komponen Tambahan | Status Tombol Aksi |
| :--- | :--- | :--- | :--- | :--- |
| **Ujian Selesai** | `isAttemptCompleted` | Hijau/Abu-abu: "Selesai Dikerjakan" / "Didiskualifikasi" | Skor nilai (jika rilis) / Pengumuman nilai ditunda | Tombol aktif: "Lihat Hasil Ujian" / "Peringkat" |
| **Siswa Sedang Mengerjakan (Toleransi)** | `isAttemptInProgress` | Kuning/Merah berkedip: "Sedang Berlangsung" / "Terkunci" | Sisa durasi timer aktif | Tombol aktif: "Lanjutkan Ujian" / "Buka Kunci" *(Diberikan toleransi menyelesaikan durasi meskipun `now > closeAt`)* |
| **Ujian Belum Dibuka** | `isNotYetOpen && !hasAttempt` | Kuning/Indigo: "Ujian Belum Dibuka" | **Live Countdown Banner**: `Buka dalam: 02j 15m 30d` (atau format tanggal jam) | **Tombol dinonaktifkan**: "Belum Dibuka" (disabled, abu-abu dengan ikon Clock) |
| **Ujian Telah Ditutup** | `isClosed && !hasAttempt` | Merah/Slate: "Ujian Telah Ditutup / Berakhir" | Catatan: "Sesi ujian telah ditutup pada [closeAt]" | **Tombol dinonaktifkan**: "Ujian Ditutup" (disabled, dengan ikon Lock) |
| **Sesi Tersedia (Buka)** | `!isNotYetOpen && !isClosed && !hasAttempt` | Biru/Hijau: "Tersedia / Siap Dikerjakan" | Info batas tutup: `Ditutup: [closeAt]` | Tombol aktif: "Ikuti Ujian" (Gradient biru-indigo dengan ikon ArrowRight) |

#### C. Helper Formatter Live Countdown:
```typescript
function formatCountdown(targetDate: Date, now: Date) {
  const diffMs = targetDate.getTime() - now.getTime();
  if (diffMs <= 0) return "Membuka...";
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}h ${hours}j ${minutes}m`;
  return `${String(hours).padStart(2, "0")}j ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}d`;
}
```

---

## 4. Analisis & Rencana Student Quiz Runner (`/student/quiz/[quizId]`)

### 4.1 Logika Pembatasan Akses & Toleransi Waktu (Window & Tolerance)

#### A. Validasi Sisi Server (`/api/quiz/[quizId]` & `/api/quiz/[quizId]/start`):
1. **Pemeriksaan `openAt`**:
   - Jika `quiz.openAt` diisi dan `new Date() < new Date(quiz.openAt)`:
   - Jika pengguna adalah Siswa (bukan Admin Preview) dan belum memiliki attempt:
   - Kembalikan response `{ success: false, status: "NOT_OPEN", error: "Ujian belum dibuka. Ujian baru dapat diakses pada [openAt formatted]", openAt: quiz.openAt }` dengan HTTP 403.
2. **Pemeriksaan `closeAt`**:
   - Jika `quiz.closeAt` diisi dan `new Date() > new Date(quiz.closeAt)`:
   - Cek apakah siswa sudah memiliki attempt `IN_PROGRESS` atau `LOCKED` (dimulai sebelum `closeAt`).
   - Jika **TIDAK ADA** attempt (siswa baru mencoba masuk setelah lewat jam tutup):
     - Kembalikan response `{ success: false, status: "CLOSED", error: "Ujian telah ditutup. Batas waktu mulai ujian telah berakhir.", closeAt: quiz.closeAt }` dengan HTTP 403.
   - Jika **ADA** attempt aktif:
     - **Toleransi Diberikan**: Siswa diizinkan melanjutkan pengerjaan sesi ujiannya sampai sisa durasi pribadinya habis!
3. **Perhitungan Sisa Durasi Pribadi (Timer Recovery)**:
   Saat attempt aktif dimuat di Quiz Runner (`src/app/student/quiz/[quizId]/page.tsx`):
   ```typescript
   const totalDurationSecs = (qData.durationMinutes || 30) * 60;
   if (att && att.startedAt) {
     const elapsedSecs = Math.floor((Date.now() - new Date(att.startedAt).getTime()) / 1000);
     const remainingSecs = Math.max(0, totalDurationSecs - elapsedSecs);
     setTimeLeftSeconds(remainingSecs);
     if (remainingSecs <= 0 && att.status === "IN_PROGRESS") {
       // Otomatis kumpulkan jika sisa durasi habis
       handleAutoSubmitOnTimeout();
     }
   } else {
     setTimeLeftSeconds(totalDurationSecs);
   }
   ```
   *Keuntungan*: Siswa tidak bisa "mereset" waktu dengan merefresh halaman (anti-cheat timer), dan siswa yang mulai 5 menit sebelum `closeAt` tetap mendapatkan sisa durasi pengerjaannya secara adil.

#### B. Tampilan Layar Penolakan Akses (Access Restricted Screen):
Jika Quiz Runner mendeteksi status `NOT_OPEN` atau `CLOSED`:
- Menampilkan layar ramah dengan kartu elegan bertema VeloExambro:
  - Untuk `NOT_OPEN`: Ikon Jam/Kalender dengan live countdown hitung mundur hingga waktu buka dan tombol "Kembali ke Pusat Ujian".
  - Untuk `CLOSED`: Ikon Gembok merah dengan keterangan waktu berakhir dan tombol "Kembali ke Pusat Ujian".

---

### 4.2 Background Progress Sync (`/api/quiz/[quizId]/progress`)

#### A. Kebutuhan R3:
Setiap kali siswa memilih/mengubah opsi jawaban (pilihan ganda, checkbox, benar/salah, isian singkat, atau uraian), progress jawaban dan skor sementara harus disinkronkan ke database di latar belakang secara non-blocking agar live proctor dapat memantau leaderboard bergerak realtime ala Quizizz.

#### B. Desain Endpoint `/api/quiz/[quizId]/progress/route.ts`:
- **Method**: `POST`
- **Autentikasi**: Memeriksa sesi siswa yang sedang login.
- **Payload**:
  ```json
  {
    "answers": {
      "q_1": { "optionId": "opt_a" },
      "q_2": { "selectedOptionIds": ["opt_b", "opt_c"] },
      "q_3": { "textResponse": "Jawaban singkat" }
    }
  }
  ```
- **Logika Endpoint**:
  1. Cari `QuizAttempt` aktif siswa dengan status `IN_PROGRESS` atau `LOCKED`.
  2. Hitung jumlah soal terjawab (`answeredCount`) dan total skor sementara (`tempScore`) untuk tipe soal auto-gradable (`SINGLE_CHOICE`, `CHECKBOXES`, `TRUE_FALSE`, `SHORT_ANSWER`).
  3. Perbarui field `answers` dan `score` pada record `QuizAttempt`.
  4. Lakukan `upsert` pada tabel `QuizStudentAnswer` untuk masing-masing soal yang dijawab agar rincian per butir soal tersimpan.
  5. Kembalikan respons cepat:
     ```json
     {
       "success": true,
       "data": {
         "answeredCount": 8,
         "totalQuestions": 10,
         "currentScore": 75,
         "totalPossibleScore": 100,
         "lastSyncedAt": "2026-08-30T01:45:00.000Z"
       }
     }
     ```

#### C. Hooking di Quiz Runner (`src/app/student/quiz/[quizId]/page.tsx`):
1. **Snappy Local UI State**: Ketika siswa klik opsi jawaban, state `answers` dan `localStorage` langsung diperbarui secara instan (0 milidetik latency).
2. **Debounced Background Sync**:
   Menggunakan `useRef` timer untuk men-debounce panggilan API sebesar 400ms-600ms (terutama berguna saat siswa mengetik essay/isian singkat):
   ```typescript
   const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

   const triggerBackgroundSync = useCallback((newAnswers: Record<string, StudentAnswerState>) => {
     if (isPreview || isCompleted || isDisqualified) return;

     if (syncTimerRef.current) {
       clearTimeout(syncTimerRef.current);
     }

     syncTimerRef.current = setTimeout(async () => {
       try {
         await fetch(`/api/quiz/${quizId}/progress`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ answers: newAnswers }),
           keepalive: true,
         });
       } catch (err) {
         // Silent failover - offline draft tetap aman di localStorage
         console.warn("[BackgroundSync] Offline/Delayed sync:", err);
       }
     }, 500);
   }, [quizId, isPreview, isCompleted, isDisqualified]);
   ```
3. Panggil `triggerBackgroundSync` di:
   - `handleSelectOption`
   - `handleToggleMultipleOption`
   - `handleTextResponseChange`

#### D. Perbaikan Format Payload pada Submit (`/api/quiz/submit/route.ts`):
*Temuan Investigasi Penting*:
Pada `src/app/api/quiz/submit/route.ts` baris 23, validasi saat ini memeriksa `if (!quizId || !Array.isArray(answers))`. Namun pada `QuizTakingPage` (baris 67 & 383), `answers` disimpan dan dikirimkan sebagai objek dictionary: `{ [questionId: string]: StudentAnswerState }`.
*Solusi*: Di `/api/quiz/submit/route.ts` dan `/api/quiz/[quizId]/progress/route.ts`, dukung konversi otomatis baik format objek maupun array:
```typescript
const answersList: Array<{ questionId: string; optionId?: string; selectedOptionIds?: string[]; textResponse?: string }> =
  Array.isArray(answers)
    ? answers
    : Object.entries(answers || {}).map(([qId, val]: [string, any]) => ({
        questionId: qId,
        ...val,
      }));
```

---

## 5. Kepatuhan Standar AGENTS.md & Mobile Responsiveness

### 5.1 Custom UI Dialogs Standard (No Native Alert/Confirm/Prompt)
- **Hasil Pemindaian Ripgrep**: `0` penggunaan `alert()`, `confirm()`, atau `prompt()` native di seluruh folder `src/`.
- Seluruh konfirmasi aksi (seperti pengumpulan ujian, penghapusan butir soal, pembukaan kunci pengawas, dan diskualifikasi peserta) telah 100% menggunakan `useDialog()` dari `@/components/ui/DialogProvider`.
- Semua notifikasi umpan balik menggunakan sistem toast non-blocking (`toast.success`, `toast.error`, `toast.warning`, `toast.info`).

### 5.2 Mobile Responsiveness Standard (< 640px)
- **Quiz Runner Navigation**:
  Menggunakan floating bottom dock dengan lebar adaptif `w-[94%] sm:w-auto max-w-xl fixed bottom-4 left-1/2 -translate-x-1/2` yang sangat ergonomis untuk navigasi jempol satu tangan di layar smartphone.
- **Palet Kisi Soal**:
  Modal palet soal (`showQuestionPalette`) beradaptasi dengan `max-h-[85vh]` dan grid 5 kolom yang dapat di-scroll vertikal tanpa merusak layout.
- **Tabel & Data Display**:
  Seluruh tabel live monitoring memiliki pembungkus `overflow-x-auto`.
- **Header & Action Bars**:
  Menggunakan flex wrapper responsif `flex-col sm:flex-row flex-wrap` agar tombol aksi tertumpuk rapi pada smartphone tanpa terpotong.

### 5.3 Standar CBT Anti-Cheat & Exambro Proctoring
- Parameter `enableCameraProctor` disetel secara default ke `false` (`@default(false)`).
- Anti-kecurangan CBT difokuskan pada event browser teruji: `visibilitychange`, `pagehide`, dan `fullscreenchange` yang ramah untuk performa smartphone dan menghemat baterai/kuota siswa.

---

## 6. Matrix File & Rangkuman Perubahan yang Direkomendasikan

| No | Target Berkas | Komponen / Fungsi | Rencana Perubahan |
|---|---|---|---|
| 1 | `prisma/schema.prisma` | Model `Quiz` | Tambahkan `openAt DateTime?` dan `closeAt DateTime?`. |
| 2 | `src/app/admin/exams/create/page.tsx` | Form Create Ujian Admin | Tambahkan state `openAt`, `closeAt`, dan input UI `datetime-local` di kartu konfigurasi. Kirimkan ke API POST. |
| 3 | `src/app/admin/exams/[quizId]/edit/page.tsx` | Form Edit Ujian Admin | Tambahkan state `openAt`, `closeAt`, load nilai yang tersimpan, dan sediakan input UI `datetime-local`. Kirimkan ke API PATCH. |
| 4 | `src/app/api/admin/exams/route.ts` & `.../[quizId]/route.ts` | Backend Admin Exam API | Dukung `openAt` & `closeAt` pada operasi POST, PATCH, dan GET. |
| 5 | `src/app/admin/exams/page.tsx` | Daftar Modul Ujian Admin | Tampilkan badge rentang jadwal buka/tutup pada tiap kartu ujian. |
| 6 | `src/app/api/student/exams/route.ts` | API Daftar Ujian Siswa | Sertakan `openAt` & `closeAt` dalam respons JSON ke siswa. |
| 7 | `src/app/student/exams/page.tsx` | Halaman Pusat Ujian Siswa | Implementasikan live timer tick 1 detik, kartu countdown "Ujian Belum Dibuka", status "Sedang Berlangsung", "Ujian Telah Ditutup / Berakhir", dan status tombol dinonaktifkan yang sesuai. |
| 8 | `src/app/api/quiz/[quizId]/route.ts` | API Detail Quiz Siswa | Validasi jendela `openAt` & `closeAt`. Tolak akses jika di luar jendela (kecuali admin preview atau siswa memiliki attempt aktif dalam toleransi). |
| 9 | `src/app/api/quiz/[quizId]/start/route.ts` | API Start Attempt Ujian | Validasi jendela buka/tutup sebelum membuat attempt baru. Dukung parameter token `body.examToken \|\| body.token`. |
| 10 | `src/app/api/quiz/[quizId]/progress/route.ts` | **(Baru)** API Progress Sync Siswa | Endpoint baru untuk menyimpan progress soal dan skor sementara secara background real-time. |
| 11 | `src/app/student/quiz/[quizId]/page.tsx` | Quiz Runner Siswa | 1) Tambahkan layar tampilan penolakan akses `NOT_OPEN` & `CLOSED`.<br>2) Tambahkan pemulihan sisa waktu pribadi (toleransi durasi).<br>3) Hubungkan `triggerBackgroundSync` ke `/api/quiz/[quizId]/progress`. |
| 12 | `src/app/api/quiz/submit/route.ts` | API Submit Ujian Siswa | Dukung parsing format `answers` berupa dictionary objek dan array. |

---

## 7. Kesimpulan

Rencana integrasi penjadwalan rentang waktu (`openAt`/`closeAt`), penyesuaian UI Student Exams dengan live countdown, penegakan toleransi waktu pada Quiz Runner, dan sinkronisasi cepat progress background ke `/api/quiz/[quizId]/progress` telah terpetakan dengan sangat presisi dan siap dieksekusi tanpa kendala arsitektural. Seluruh kode yang ditinjau mematuhi 100% aturan `AGENTS.md` (kepatuhan `useDialog`, bebas popup browser native, dan responsif mobile).
