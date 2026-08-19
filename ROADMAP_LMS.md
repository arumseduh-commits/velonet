# Peta Jalan (Roadmap): Mengubah VeloNet Menjadi LMS Overpower

Roadmap ini memberikan panduan langkah demi langkah untuk mengimplementasikan fitur-fitur yang telah dijabarkan di dalam dokumen PRD.

## Fase 1: Fondasi Inti & Infrastruktur (Minggu 1-2)
**Tujuan:** Menyiapkan database dan backend untuk mendukung konten pembelajaran elektronik (e-learning).

- [ ] **Migrasi Database**: 
  - Memperbarui `schema.prisma` dengan model baru (`Course`, `Chapter`, `Lesson`, `Enrollment`, `Role` enum).
  - Menjalankan `prisma migrate dev` dan melakukan generate client Prisma.
- [ ] **Manajemen Peran (Autentikasi)**:
  - Mengimplementasikan Role-Based Access Control (RBAC) di middleware Next.js dan API routes.
  - Membuat dashboard yang terpisah untuk `ADMIN`, `MENTOR`, dan `STUDENT`.
- [ ] **Course Builder (UI Admin/Mentor)**:
  - Antarmuka (UI) untuk membuat dan mengelola Kursus, Bab, dan Pelajaran.
  - Integrasi dengan Rich Text Editor (misalnya Tiptap atau Quill) untuk pelajaran berbasis teks.
  - Memastikan UI responsif dan menggunakan komponen `useDialog()` kustom untuk setiap konfirmasi tindakan.

## Fase 2: Pengalaman Belajar (Minggu 3-4)
**Tujuan:** Memungkinkan siswa untuk mengakses materi pelajaran dan mengumpulkan tugas.

- [ ] **Dashboard Siswa**:
  - Menampilkan kursus yang diikuti beserta bar progresnya.
- [ ] **Penampil Materi (Lesson Viewer)**:
  - UI untuk mengakses Teks, Video, dan Kuis.
  - Implementasi pelacakan `Progress` (menandai pelajaran sebagai selesai).
- [ ] **Mesin Penugasan (Assignment Engine)**:
  - UI bagi siswa untuk mengunggah file tugas atau mengirimkan link/teks.
  - UI Buku Nilai (Gradebook) bagi mentor untuk meninjau tugas yang dikumpulkan, memberi nilai, dan memberikan umpan balik (feedback).
- [ ] **Kuis Tingkat Lanjut**:
  - Migrasi dari data JSON `ScrapedArticle` lama ke model tabel Kuis relasional yang proper.
  - Logika penilaian otomatis untuk soal pilihan ganda.

## Fase 3: Fitur "Overpowered" - Gamifikasi & Interaksi (Minggu 5-6)
**Tujuan:** Membuat platform menjadi adiktif dan menarik bagi peserta Ekstra Velocity.

- [ ] **Sistem XP & Leveling**:
  - Mengimplementasikan `GamificationProfile`.
  - Logika sistem untuk memberikan hadiah XP setelah menyelesaikan pelajaran, menghadiri pertemuan (terintegrasi dengan sistem `Attendance` yang sudah ada), dan mendapatkan nilai kuis tinggi.
- [ ] **Papan Peringkat (Leaderboards)**:
  - Papan peringkat global (semua siswa) dan papan peringkat khusus per kursus.
- [ ] **Pencapaian & Lencana (Badges)**:
  - Membuat pemicu (trigger) untuk pemberian lencana (contoh: aktif 7 hari berturut-turut, nilai kuis sempurna).
- [ ] **Otomatisasi WhatsApp (Integrasi Baileys)**:
  - Mengotomatiskan pesan WA untuk memberi tahu siswa jika ada nilai baru yang masuk.
  - Mengirimkan laporan progres mingguan atau peringatan "tugas belum dikerjakan" secara otomatis.

## Fase 4: AI & Otomatisasi Lanjutan (Minggu 7+)
**Tujuan:** Mengimplementasikan fitur-fitur kecerdasan buatan (AI) termutakhir.

- [ ] **Pembuat Kuis AI**:
  - Mengintegrasikan API OpenAI/Gemini agar mentor dapat membuat soal pilihan ganda secara otomatis berdasarkan teks pelajaran yang ada.
- [ ] **Bot Tutor AI**:
  - Antarmuka obrolan di dashboard siswa yang dapat menjawab pertanyaan secara ketat berdasarkan konteks kursus (menggunakan metode RAG - Retrieval-Augmented Generation).
- [ ] **Koreksi Kode Otomatis (Jika relevan)**:
  - Jika materinya adalah pemrograman (koding), terapkan analisis statik dasar atau umpan balik awal berbasis AI pada kode yang dikumpulkan siswa.

---
**Catatan Aturan VeloNet:** 
Selalu patuhi pedoman mutlak yang tertulis di `AGENTS.md` selama proses pengembangan: Dilarang keras menggunakan dialog bawaan browser, dan pastikan seluruh komponen UI yang baru 100% responsif terhadap layar mobile (`< 640px`).
