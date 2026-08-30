# Original User Request

## 2026-08-29T18:32:12Z

Implementasi Penjadwalan Jendela Waktu Ujian (Rentang Hari & Jam Buka/Tutup) dan Dashboard Realtime Live Proctor Leaderboard interaktif bergerak ala Quizizz untuk sistem CBT VeloNet.

Working directory: c:\UBIG\VeloNet
Integrity mode: development

## Requirements

### R1. Penjadwalan Rentang Waktu Ujian (Window of Availability)
1. Pada model `Quiz` di `prisma/schema.prisma`, sediakan kolom `openAt DateTime?` (Jadwal Buka Ujian) dan `closeAt DateTime?` (Jadwal Tutup Ujian). Sinkronkan ke database PostgreSQL via `npx prisma db push`.
2. Pada Form Pembuatan & Pengeditan Ujian Admin (`/admin/exams/create` & `/admin/exams/[quizId]/edit`), sediakan input pemilih tanggal & jam untuk `openAt` dan `closeAt` serta kirimkan nilainya ke API `/api/admin/exams`.
3. Pada Pusat Ujian Siswa (`/student/exams`) & Runner (`/student/quiz/[quizId]`):
   - Jika waktu akses `< openAt`: Akses ditolak dengan status "Ujian Belum Dibuka" dan hitung mundur menuju waktu pembukaan.
   - Jika waktu akses `> closeAt` dan siswa belum pernah mulai: Akses ditolak dengan status "Ujian Telah Ditutup / Berakhir".
   - Jika siswa memulai sebelum `closeAt`, siswa diberikan toleransi menyelesaikan sisa durasi timer pribadinya.

### R2. Realtime Live Proctor & Gamified Leaderboard ala Quizizz
1. Di halaman Pengawas Ujian Admin (`/admin/exams/[quizId]/proctor`), buat dashboard realtime yang memperbarui data secara live tiap 3 detik.
2. Tampilkan Podium Top 3 Gamifikasi (Medali Emas, Perak, Perunggu) dengan peringkat dinamis yang bergerak naik-turun sesuai skor realtime siswa ala Quizizz.
3. Tampilkan Daftar Peserta Live dengan:
   - Progress bar pengerjaan soal (Persentase terjawab & per butir soal).
   - Skor poin realtime yang bertambah saat siswa menjawab benar.
   - Status live koneksi: Aktif Mengerjakan, Selesai Dikumpulkan, Terkunci Pelanggaran, atau Didiskualifikasi.
   - Indikator Strike Pelanggaran (Kuning untuk 1-2 strike, Merah untuk 3 strike).
4. Sediakan Tombol Kontrol Pengawas Cepat pada tiap baris siswa:
   - Buka Kunci Pelanggaran (Unlock).
   - Paksa Kumpulkan Jawaban (Force Submit).
   - Diskualifikasi / Kick Peserta.
5. Sediakan filter kelas dan pengurutan (Skor Tertinggi, Paling Cepat, atau Pelanggaran Terbanyak).

### R3. Sinkronisasi Progress Cepat Siswa (`/api/quiz/[quizId]/progress`)
1. Setiap kali siswa memilih/mengubah jawaban di ujian CBT, progress soal dan skor sementara disinkronkan ke server secara background tanpa membebani pengerjaan siswa.

## Acceptance Criteria

### Verifikasi Database & Skema
- [ ] Database skema Prisma memiliki `openAt` dan `closeAt` pada model `Quiz` dan tersinkronisasi ke database PostgreSQL via `npx prisma db push`.

### Verifikasi Penjadwalan Ujian
- [ ] Admin dapat menyetel jadwal buka & tutup ujian secara fleksibel.
- [ ] Siswa tidak dapat masuk ujian jika waktu sekarang berada di luar rentang jadwal yang ditentukan.

### Verifikasi Live Proctor Leaderboard
- [ ] Dashboard `/admin/exams/[quizId]/proctor` memuat seluruh siswa aktif dan memperbarui skor serta urutan peringkat secara realtime ala Quizizz.
- [ ] Aksi kontrol pengawas (Unlock, Force Submit, Kick) berfungsi dengan validitas dialog konfirmasi aman (`useDialog`).

### Verifikasi Kualitas & Standar Proyek
- [ ] Tampilan 100% responsif mobile & desktop sesuai aturan UI/UX VeloNet.
- [ ] `npm run build` sukses 100% dengan 0 error TypeScript.
- [ ] Seluruh perubahan di-commit dan di-push ke branch `main` GitHub.

## 2026-08-30T15:58:28Z

Lakukan audit menyeluruh dan optimasi arsitektur database indexing Prisma, eliminasi transmisi payload berat data biometrik, serta refactor query batching CBT dan sinkronisasi bot pada aplikasi VeloNet.

Working directory: c:\UBIG\VeloNet
Integrity mode: development

## Requirements

### R1. Comprehensive Database Indexing
Tambahkan definisi indeks komposit dan foreign key index pada Prisma Schema (`prisma/schema.prisma`) untuk seluruh model relasi dan filter sorting utama (`User`, `MeetingSession`, `Attendance`, `Question`, `Option`, `QuizAttempt`, `QuizStudentAnswer`, `Chapter`, `Lesson`, `Enrollment`, `Progress`, `Submission`, `XPLog`, `UserBadge`, `AIChatSession`, `AIChatMessage`).

### R2. Payload Diet & Elimination of Blocking I/O
Pangkas transfer data berlebih dengan mengecualikan kolom `facePhoto` (base64 gambar berukuran besar) dari query daftar peserta (`/api/participants`) dan endpoint face descriptors (`/api/attendance/face-descriptors`). Hapus pemanggilan blocking resolving LID dari critical GET request path.

### R3. Batching & Transaction Optimization
Refactor loop database sequential (N+1 query) pada pengumpulan ujian CBT (`/api/quiz/submit`) dan sinkronisasi anggota grup bot (`fetchGroupMembersWithStatus` di `bot-engine.ts`) menjadi batch query (`findMany` dengan operator `in`) dan eksekusi transaksi paralel (`Promise.all` / `prisma.$transaction`).

### R4. Code Integrity & Build Verification
Pastikan seluruh komponen dan endpoint tetap mematuhi standar UI/UX dialog custom (`useDialog`), mobile responsive, dan lolos verifikasi build Next.js (`npm run build`) tanpa error.

## Acceptance Criteria

### Database & Indexing
- [ ] Seluruh relasi foreign key dan kolom filter/sort pada `prisma/schema.prisma` memiliki definisi `@@index`.

### Performance & Payload Diet
- [ ] Endpoint `GET /api/participants` mengembalikan metadata peserta tanpa membebani jaringan dengan raw base64 `facePhoto`.
- [ ] Endpoint `GET /api/attendance/face-descriptors` hanya mengirimkan vektor embedding biometrik (`faceDescriptor`) dan metadata esensial (<50KB total untuk 30 user).
- [ ] Pengumpulan kuis/ujian CBT memproses penilaian seluruh butir soal dalam satu transaksi/batch paralel.
- [ ] Pencocokan anggota grup bot menggunakan single batch `findMany` untuk seluruh anggota grup sekaligus.

### Build & Integrity
- [ ] Project lolos build dan type-check Next.js (`npm run build`) tanpa error.
- [ ] Perubahan kode disinkronkan dan di-commit ke Git repository.
