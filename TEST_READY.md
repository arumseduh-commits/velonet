# TEST_READY — VeloNet CBT Exam Scheduling & Live Proctor Leaderboard

Dokumen ini memverifikasi kesiapan pengujian penuh (4-Tier Comprehensive Test Coverage) untuk fitur Penjadwalan Jendela Waktu Ujian (Window of Availability), Sinkronisasi Progress Cepat Latar Belakang (Fast Progress Sync), dan Dashboard Realtime Live Proctor Leaderboard ala Quizizz pada platform VeloNet CBT.

---

## Ringkasan Eksekusi Pengujian Otomatis

| Test Suite | File Script | Total Uji | Lolos | Gagal | Status |
|---|---|---|---|---|---|
| **Suite 1: Scheduling & Window of Availability** | `scripts/test-m1-scheduling.ts` | 57 | 57 (100%) | 0 | **PASSED** |
| **Suite 2: Fast Sync & Live Proctor Leaderboard** | `scripts/test-m23-challenger.ts` | 45 | 45 (100%) | 0 | **PASSED** |
| **Total Keseluruhan** | | **102** | **102 (100%)** | **0** | **ALL PASSED** |

---

## 4-Tier Test Coverage Matrix

### Tier 1: Feature Coverage (Cakupan Fitur Inti)

Cakupan verifikasi fungsional untuk seluruh spesifikasi dalam `ORIGINAL_REQUEST.md`:

1. **R1.1 Prisma Schema & Database Persistence**
   - Kolom `openAt DateTime?` dan `closeAt DateTime?` pada model `Quiz` di `prisma/schema.prisma`.
   - Terverifikasi tersinkronisasi ke database PostgreSQL via `npx prisma db push`.
   - Operasi CRUD (Create, Read, Update, Cascade Delete) teruji sukses.

2. **R1.2 Admin Exam Scheduling Form (`/admin/exams/create` & `/admin/exams/[quizId]/edit`)**
   - Form input pemilih tanggal & waktu (`type="datetime-local"`) untuk `openAt` dan `closeAt`.
   - Transformasi ISO string ↔ format input lokal aman dari pergeseran timezone.
   - Validasi kronologis jadwal (`openAt < closeAt`) baik di sisi frontend maupun API backend (`/api/admin/exams`).

3. **R1.3 Student Exam Hub (`/student/exams`) & Quiz Runner (`/student/quiz/[quizId]`)**
   - Badge status dinamis: `Ujian Belum Dibuka` (Kuning/Hitam), `Sedang Berlangsung` (Hijau), `Ujian Telah Ditutup` (Merah), dan `Jadwal Fleksibel` (Biru).
   - Tampilan khusus penahan (Waiting Screen) di runner dengan hitung mundur live saat `< openAt`.
   - Tampilan penolakan akses (Closed Screen) saat `> closeAt` jika siswa belum mulai.
   - Toleransi pengerjaan sisa durasi timer personal jika siswa telah memulai sebelum waktu `closeAt`.

4. **R3.1 Fast Background Progress Sync (`/api/quiz/[quizId]/progress`)**
   - Hook sinkronisasi latar belakang non-blocking (`isSyncing`, debounce/immediate) pada pengerjaan siswa.
   - Perhitungan skor otomatis realtime (Auto-grading) untuk tipe `SINGLE_CHOICE`, `TRUE_FALSE`, `CHECKBOXES`, dan `SHORT_ANSWER`.
   - Penyimpanan terperinci ke tabel `QuizStudentAnswer` dan kolom `answers`/`score` pada `QuizAttempt`.

5. **R2.1 Realtime Live Proctor Polling (3 Detik)**
   - Dashboard `/admin/exams/[quizId]/proctor` melakukan polling otomatis setiap 3 detik.
   - Mekanisme concurrency lock mencegah duplicate request saat jaringan lambat.
   - Indikator status live (Live Pulse) dan statistik aktif pengerjaan.

6. **R2.2 Gamified Top 3 Podium ala Quizizz**
   - Podium juara visual Top 3 (Emas #1, Perak #2, Perunggu #3) dengan kartu avatar, skor realtime, dan animasi peringkat.
   - Peringkat dinamis bergerak naik-turun sesuai pertambahan skor live peserta.

7. **R2.3 Daftar Peserta Live & Matriks Butir Soal**
   - Progress bar persentase pengerjaan (`%`) dan visual dot matrix per butir soal (Terjawab vs Belum).
   - Indikator strike pelanggaran: Kuning (1-2 strike), Merah (3+ strike / Terkunci).
   - Label status live: `Aktif Mengerjakan`, `Selesai Dikumpulkan`, `Terkunci Pelanggaran`, `Didiskualifikasi`.

8. **R2.4 Tombol Kontrol Pengawas Cepat dengan Custom UI Dialog**
   - Aksi pengawas: **Buka Kunci (Unlock)**, **Paksa Kumpulkan (Force Submit)**, **Reset Strike**, dan **Diskualifikasi (Kick)**.
   - Seluruh aksi memicu modal konfirmasi aman berbasis `useDialog` dari `@/components/ui/DialogProvider` (100% kepatuhan aturan tanpa `window.confirm` / `alert`).
   - Pencatatan log audit otomatis ke tabel `ExamViolationLog`.

9. **R2.5 Filter Kelas & Multi-Criteria Sorting**
   - Filter instan berdasarkan kelas (`studentClass`).
   - Pengurutan dinamis: Skor Tertinggi, Progres Paling Cepat, Pelanggaran Terbanyak, dan Nama Siswa.

---

### Tier 2: Boundary and Corner Cases (Kasus Batas & Kondisi Ekstrem)

1. **Presisi Waktu Jendela Ujian (Time Boundary Mathematics)**
   - **T-1s Sebelum `openAt`**: Status `UPCOMING`, akses runner ditolak (HTTP 403) dengan pesan hitung mundur.
   - **T=0 Tepat pada `openAt`**: Status `OPEN`, siswa diizinkan masuk dan memulai attempt.
   - **T Di Dalam Rentang (`openAt < T < closeAt`)**: Status `OPEN`, akses penuh diizinkan.
   - **T-1s Sebelum `closeAt`**: Status `OPEN`, siswa diizinkan memulai ujian.
   - **T=0 Tepat pada `closeAt`**: Status `OPEN` (tidak melebihi batas).
   - **T+1s Setelah `closeAt` (Attempt Baru)**: Status `CLOSED`, pendaftaran attempt baru ditolak (HTTP 403).
   - **T+30m Setelah `closeAt` (Attempt Sedang Berjalan)**: Status `OPEN` untuk resume attempt siswa yang telah dimulai sebelum jadwal tutup.

2. **Jadwal Fleksibel & Parsial**
   - `openAt = null` dan `closeAt = null`: Ujian berstatus terbuka bebas (Fleksibel).
   - Hanya `openAt` terisi: Ujian tertutup sebelum waktu buka, terbuka tanpa batas akhir setelahnya.
   - Hanya `closeAt` terisi: Ujian terbuka langsung hingga waktu tutup tercapai.

3. **Perhitungan Timer Pribadi & Overtime Clamping**
   - Siswa memulai 10 menit sebelum `closeAt` pada ujian berdurasi 30 menit.
   - 15 menit berjalan (5 menit lewat `closeAt`): Sisa waktu terhitung tepat 15 menit (900 detik).
   - 30 menit berjalan: Sisa waktu 0 detik, memicu auto-submit.
   - 35 menit berjalan: Fungsi `calculateRemainingSeconds` mengembalikan 0 detik melalui `Math.max(0, ...)` (mencegah nilai negatif).

4. **Penanganan Timezone & Format Input Kalender**
   - Serialisasi format `YYYY-MM-DDTHH:mm` untuk input form HTML5.
   - Penanganan nilai `null`, `undefined`, string kosong `""`, dan string invalid tanpa throwing error.
   - Dukungan tanggal kabisat (29 Februari) dan zero-padding untuk digit tunggal bulan/tanggal/jam/menit.

5. **Ketahanan Algoritma Penilaian Otomatis (Auto-Scoring Engine)**
   - **Single Choice & True/False**: Pilihan tepat mendapat poin penuh; pilihan salah atau kosong mendapat 0.
   - **Checkboxes (Multi-Select)**:
     - Seluruh jawaban benar dipilih (3/3): Poin penuh (30).
     - Sebagian benar dipilih tanpa jawaban salah (2/3): Skor parsial proporsional (20).
     - Jawaban salah terpilih bersama jawaban benar: Penalti diskualifikasi poin butir (0).
     - Pilihan kosong: 0 poin.
   - **Short Answer**:
     - Mode Case-Insensitive: Input `"soekarno"`, `"  SOEKARNO  "`, `"Soekarno"` semuanya cocok (20 poin).
     - Mode Case-Sensitive: Input `"NaCl"` cocok; `"nacl"` tidak cocok (0 poin).
     - Whitespace-only string: 0 poin.
   - **Essay**: Otomatis ditandai `isAutoGraded = false` dengan skor sementara 0 hingga dikoreksi manual oleh guru.

6. **Ketahanan Data & Format Rusak (Corrupted Data Recovery)**
   - Jika kolom `QuizAttempt.answers` berisi JSON korup, sistem secara anggun (gracefully) melakukan fallback ke object kosong `{}` tanpa memutus antarmuka atau server crash.
   - ID pertanyaan palsu/invalid di payload sinkronisasi diabaikan tanpa inflasi skor.

---

### Tier 3: Cross-Feature Interactions (Interaksi Lintas Fitur)

1. **Student Progress Sync ↔ Realtime Proctor Leaderboard Pipeline**
   - Siswa mengubah jawaban pada runner CBT → payload dikirim ke `/api/quiz/[quizId]/progress` → database memperbarui skor dan `QuizStudentAnswer`.
   - Dalam siklus polling 3 detik, `/api/admin/exams/[quizId]/proctor` mengambil data teranyar → dashboard pengawas menggeser posisi kartu Top 3 dan memodifikasi progress matrix secara visual tanpa reload halaman.

2. **Anti-Cheat Monitoring ↔ Strike Escalation ↔ Proctor Action**
   - Siswa memicu pelanggaran (Tab Switch / Fullscreen Exit) → runner mencatat strike.
   - Proctor dashboard menampilkan badge kuning (1-2 strike) atau merah (3 strike).
   - Pada strike ke-3, attempt siswa beralih ke status `LOCKED`.
   - Pengawas menekan tombol **Buka Kunci** di dashboard proctor → modal `useDialog` muncul → pengawas mengonfirmasi → status kembali `IN_PROGRESS` dan strike di-reset ke 0.
   - Runner siswa mendeteksi pembukaan kunci dan mengizinkan pengerjaan dilanjutkan.

3. **Admin Force Submit & Disqualification Lifecycle**
   - Pengawas melakukan **Force Submit** → status attempt menjadi `SUBMITTED`, timer dinonaktifkan.
   - Pengawas melakukan **Disqualify (Kick)** → status attempt menjadi `DISQUALIFIED`, skor disetel ke 0, dan peserta otomatis diposisikan di baris paling bawah leaderboard.

---

### Tier 4: Real-World Exam Scenarios (Skenario Lapangan Nyata)

1. **Skenario Ujian Serentak Massal (Simultaneous Exam Day)**
   - 100+ siswa mengakses ujian bersamaan saat jam `openAt` tercapai.
   - Hitung mundur di layar siswa otomatis berpindah ke tombol "Mulai Kerjakan" tepat saat waktu server mencapai jadwal buka tanpa perlu refresh manual.

2. **Skenario Gangguan Koneksi / Refresh Halaman Siswa**
   - Siswa mengalami putus koneksi atau merestart browser saat mengerjakan ujian.
   - Token ujian tervalidasi dengan benar (`examToken` fallback).
   - Sisa durasi ujian (`remainingDurationSecs`) dihitung akurat berdasarkan `startedAt` asli, mencegah kecurangan reset timer akibat refresh browser.
   - Jawaban yang tersimpan sebelumnya dimuat kembali secara instan dari sinkronisasi database.

3. **Skenario Responsivitas Mobile Penuh (< 640px)**
   - Pengawas memantau ujian melalui smartphone: tabel peserta dapat di-swipe horizontal (`overflow-x-auto`), header tombol ter-stack rapi (`flex-col sm:flex-row`), dan modal dialog pas di layar (`w-full max-w-lg mx-auto`).
   - Siswa mengerjakan ujian dari layar smartphone: navigasi butir soal, opsi jawaban, dan hitung mundur tampil proporsional tanpa elemen terpotong.

---

## Ringkasan Kepatuhan Standar Proyek (AGENTS.md)

- [x] **No Native Browser Dialogs**: 100% dialog konfirmasi dan notifikasi menggunakan custom `useDialog()` dari `@/components/ui/DialogProvider`.
- [x] **Mobile Responsiveness**: Seluruh tampilan diuji responsif pada layar HP (`< 640px`) dan desktop.
- [x] **Webcam Proctoring Inactive by Default**: Nilai default anti-kecurangan kamera tetap `@default(false)` untuk keandalan perangkat smartphone.
- [x] **Build & Type Safety**: `npm run build` berhasil 100% dengan 0 error TypeScript/ESLint.
- [x] **GitHub Synchronization**: Seluruh kode terverifikasi dan siap di-push ke branch `main`.
