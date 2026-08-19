# Dokumen Persyaratan Produk (PRD): VeloNet LMS "Overpower"

## 1. Ringkasan Eksekutif
Saat ini, VeloNet adalah sistem manajemen peserta dan kehadiran untuk "Ekstra Velocity", yang memanfaatkan notifikasi WhatsApp (menggunakan Baileys) dan presensi berbasis GPS. 
Tujuan proyek ini adalah mengubah VeloNet menjadi **Learning Management System (LMS) yang "Overpower"**. Artinya, sistem ini tidak hanya sekadar menyediakan materi pelajaran, tetapi juga menyertakan fitur tingkat tinggi (gamifikasi, pembelajaran berbasis AI, pendampingan mentor otomatis, dan analitik mendalam), sambil tetap mempertahankan keunggulannya dalam absensi fisik dan integrasi WhatsApp.

## 2. Analisis Keadaan Saat Ini (Berdasarkan Codebase)
### Fitur yang Sudah Ada
- **Manajemen Peserta**: CRUD dasar untuk siswa, verifikasi OTP via WhatsApp.
- **Sistem Kehadiran (Presensi)**: Presensi berbasis GPS untuk pertemuan fisik/hybrid, preset lokasi, manajemen sesi pertemuan.
- **Integrasi WhatsApp**: Bot WhatsApp berbasis Baileys untuk notifikasi.
- **Konten Dasar**: Model `ScrapedArticle` dengan data kuis sederhana berbasis JSON.
- **Tech Stack**: Next.js (App Router), Prisma (PostgreSQL), Tailwind CSS.

### Kekurangan untuk Menjadi LMS
- Belum ada alur pembelajaran yang terstruktur (Kursus -> Bab -> Pelajaran/Lesson).
- Belum ada konsep Peran Pengguna (Admin vs. Mentor vs. Siswa).
- Tidak ada sistem pengumpulan tugas atau pemberian nilai (grading).
- Kurangnya sistem untuk memotivasi siswa (tidak ada gamifikasi, tidak ada pelacakan progres).

## 3. Visi & Tujuan
Membangun LMS canggih berkecepatan tinggi yang tidak hanya menyampaikan materi, tetapi secara aktif mendorong siswa untuk belajar lebih cepat dan lebih baik melalui otomatisasi, AI, dan gamifikasi.

**Tujuan Utama:**
1. Penyampaian konten yang terstruktur dan terukur.
2. Tingkat retensi dan keterlibatan (engagement) siswa yang tinggi.
3. Otomatisasi tugas-tugas administratif dan penilaian bagi mentor.
4. Integrasi O2O (Online-to-Offline) yang mulus (memadukan pembelajaran digital dengan kehadiran fisik).

## 4. Peran Pengguna (Roles)
1. **Super Admin**: Mengelola pengaturan sistem, status bot WhatsApp, dan preset lokasi.
2. **Mentor/Guru**: Membuat kursus/materi, menilai tugas, memantau perkembangan siswa, dan mengelola sesi pertemuan tatap muka.
3. **Student (Siswa/Peserta)**: Mengakses materi, mengumpulkan tugas, mengerjakan kuis, melacak progres pribadi, dan melakukan presensi kehadiran.

## 5. Kebutuhan Fitur

### 5.1 Fitur Inti LMS (Wajib Ada)
- **Pembuat Kursus (Course Builder)**: Struktur hierarki (Kursus > Bab > Pelajaran). Pelajaran bisa berupa Video (YouTube/Mux), Teks (Rich Text), atau PDF.
- **Role-Based Access Control (RBAC)**: Tampilan dashboard yang berbeda untuk Admin, Mentor, dan Siswa.
- **Sistem Penugasan**: Dukungan untuk unggah file, pengumpulan teks, atau link (misal: link GitHub).
- **Kuis Tingkat Lanjut**: Pilihan ganda, isian singkat, kuis berbatas waktu, dan penilaian otomatis.
- **Buku Nilai (Gradebook)**: Penilaian terpusat bagi Mentor, lengkap dengan dukungan rubrik penilaian.
- **Pelacakan Progres**: Bar persentase progres untuk setiap kursus, dan sertifikat kelulusan.

### 5.2 Fitur "Overpower" (Faktor Pembeda Velocity)
- **Mesin Gamifikasi**:
  - **XP & Level**: Dapatkan XP saat hadir pertemuan, menyelesaikan pelajaran, atau mendapat nilai kuis tinggi.
  - **Papan Peringkat (Leaderboard)**: Peringkat siswa mingguan/bulanan berdasarkan XP.
  - **Lencana/Pencapaian (Badges)**: Contoh: "First Blood" (pengumpul tugas pertama), "Streak Master" (login 7 hari berturut-turut).
- **Integrasi AI**:
  - **Chatbot Tutor AI**: Bot yang dilatih menggunakan materi kursus untuk menjawab pertanyaan siswa 24/7.
  - **Pembuat Kuis AI**: Mentor dapat membuat kuis secara instan dari teks pelajaran dengan bantuan AI.
  - **Umpan Balik (Feedback) AI**: Koreksi awal otomatis untuk kode/teks yang dikumpulkan sebelum dinilai oleh mentor manusia.
- **Otomatisasi WhatsApp (Memanfaatkan Baileys yang sudah ada)**:
  - Peringatan (nudge) otomatis via WA untuk tugas yang belum dikerjakan/mendekati tenggat waktu.
  - Laporan progres mingguan dikirim ke siswa (atau orang tua) via WA.
  - Notifikasi instan via WA saat mentor selesai menilai tugas.
- **Praktik/Koding Interaktif (Jika Ekstra Velocity fokus ke IT)**:
  - Code editor (Monaco/CodeMirror) yang ditanamkan langsung di browser untuk tantangan koding.

## 6. Usulan Perubahan Skema Database (Prisma)
Untuk mendukung fitur-fitur ini, skema database memerlukan perluasan yang signifikan. 
*(Lihat file `LMS_SCHEMA_PROPOSAL.md` untuk kode Prisma lengkapnya).*

**Model Baru yang Dibutuhkan:**
- `User` (untuk menggantikan/memperluas Participant dengan peran/role)
- `Course`, `Chapter`, `Lesson`
- `Enrollment`, `Progress`
- `Assignment`, `Submission`
- `Quiz`, `Question`, `Option`, `QuizAttempt`
- `GamificationProfile`, `Badge`, `UserBadge`, `XPLog`

## 7. Persyaratan Non-Fungsional & Aturan Ketat VeloNet
- **Standar Mobile First (Responsif)**: Sesuai dengan aturan mutlak di `AGENTS.md`, antarmuka pengguna (UI) HARUS 100% responsif (dioptimalkan untuk layar `< 640px`). Tabel data harus bisa di-swipe, modal dialog harus pas di layar HP.
- **Standar UI Dialog**: Wajib secara ketat menggunakan Sistem Dialog & Toast UI bawaan/kustom (`useDialog()` dari `@/components/ui/DialogProvider`). Dialog bawaan browser (`alert`, `confirm`, `prompt`) DILARANG KERAS.
- **Performa**: Pemuatan video yang cepat, pembaruan UI yang instan (optimistic UI) untuk gamifikasi (misal: animasi popup XP).

## 8. Langkah Selanjutnya & Rencana Implementasi
1. **Fase 1: Fondasi (Minggu 1-2)**
   - Migrasi skema database (Peran, Kursus, Pelajaran).
   - Antarmuka CRUD inti agar Mentor bisa mulai membuat kursus.
2. **Fase 2: Pengalaman Belajar (Minggu 3-4)**
   - Dashboard siswa, penampil materi (lesson viewer), mesin kuis.
3. **Fase 3: Pembaruan "Overpower" (Minggu 5-6)**
   - Mesin gamifikasi (XP, Leaderboard).
   - Notifikasi dan peringatan WA otomatis.
   - Integrasi AI.
