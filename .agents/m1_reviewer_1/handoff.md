# Handoff Report — Milestone 1 Review & Adversarial Audit

**Agent**: `m1_reviewer_1`  
**Working Directory**: `c:\UBIG\VeloNet\.agents\m1_reviewer_1`  
**Milestone**: Milestone 1 (Window of Availability Scheduling, Status Badges & Runner Gating)  
**Date**: 2026-08-30  
**Handoff Type**: Hard (Review Complete)  
**Verdict**: **APPROVE**

---

## 1. Observation

1. **Prisma Database Sync**:
   - Skema Prisma memuat kolom `openAt DateTime?` dan `closeAt DateTime?` pada model `Quiz`.
   - Terverifikasi tersinkronisasi pada database PostgreSQL.

2. **Admin Create & Edit Forms (`/admin/exams/create` & `/admin/exams/[quizId]/edit`)**:
   - Kedua form menyediakan `<input type="datetime-local">` untuk `openAt` dan `closeAt`.
   - `src/app/admin/exams/[quizId]/edit/page.tsx` mengimplementasikan helper `toLocalDatetimeInputString(isoDateStr)` untuk mengonversi ISO UTC ke format lokal `YYYY-MM-DDTHH:mm` tanpa pergeseran zona waktu (timezone drift).
   - Validasi kronologis disematkan pada client (`openAt >= closeAt` memicu warning dialog/toast) serta divalidasi ulang secara ketat di backend `POST /api/admin/exams` dan `PATCH /api/admin/exams/[quizId]`.
   - Tombol reset/clear ("Hapus Jadwal" & "Hapus Batas") berfungsi mengosongkan nilai kembali menjadi `null`.
   - Pratinjau rentang validasi durasi (badge "Rentang Valid: X Menit Terbuka") dan banner peringatan inline ditampilkan secara responsif.

3. **Admin Exam List (`/admin/exams/page.tsx`)**:
   - Status badge availability dihitung secara dinamis via `getExamAvailability()`:
     - "Sedang Berlangsung" (Emerald badge dengan pulsing dot)
     - "Terjadwal" (Amber badge untuk ujian masa mendatang)
     - "Telah Berakhir" (Rose badge untuk ujian yang telah melewati `closeAt`)
     - "Akses Fleksibel" (Slate badge untuk ujian tanpa batasan waktu)
   - Informasi tanggal buka dan tutup ditampilkan dengan format `formatIndonesianDateTime()`.
   - Dialog konfirmasi hapus ujian menggunakan `confirm()` dari `useDialog()` (bukan `window.confirm`).

4. **Student Exam Hub (`/student/exams/page.tsx`)**:
   - Menggunakan 1-detik live ticking clock (`now`) untuk menghitung status dan countdown secara realtime.
   - Menampilkan status badge: "Ujian Belum Dibuka", "Sedang Berlangsung", "Ujian Telah Ditutup", "Sedang Dikerjakan", "Terkunci Pelanggaran", "Didiskualifikasi (Nilai 0)", "Selesai Dikerjakan".
   - Upcoming exams menampilkan badge hitung mundur animasi: `Dibuka dalam: HH:mm:ss` atau `X hari Y jam lagi`.
   - Tombol aksi dinonaktifkan (`disabled`) secara otomatis dengan ikon gembok untuk status belum dibuka / telah ditutup, sementara peserta yang memiliki attempt aktif tetap dapat melanjutkan ujiannya.

5. **Student Quiz Runner & Bug Fixes (`/student/quiz/[quizId]/page.tsx`)**:
   - Tampilan khusus "Ujian Belum Dibuka" dengan countdown 4 kotak (Hari, Jam, Menit, Detik) dan tombol cek status / muat ulang.
   - Tampilan khusus "Ujian Telah Ditutup / Berakhir" untuk siswa yang belum sempat memulai sebelum batas waktu berakhir.
   - Toleransi pengerjaan: Siswa yang sudah memulai sebelum `closeAt` diizinkan menyelesaikan ujian sesuai sisa durasi personalnya.
   - Bug fix timer reset: Saat reload halaman (`F5`), timer mengambil nilai dari `remainingDurationSecs` atau menghitung selisih waktu `startedAt`, mencegah timer reset kembali ke durasi penuh.
   - Bug fix token: `ExamPreCheckModal` menyalurkan `examTokenInput` ke `onStartExam(examTokenInput)`, dan API `start/route.ts` memproses baik `body.token` maupun `body.examToken`.

6. **Kepatuhan UI/UX & Standar Proyek (`AGENTS.md`)**:
   - **Dialog System**: 100% menggunakan `useDialog()` dari `@/components/ui/DialogProvider`. Grep search membuktikan **0 pemanggilan native `alert()`, `confirm()`, atau `prompt()`**.
   - **Mobile Responsiveness**: Layout menggunakan wrapper `overflow-x-auto`, flex direction `flex-col sm:flex-row`, grid adaptif `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`, dan modal responsif `w-full max-w-lg mx-auto`.
   - **Build Verification**: `npm run build` berhasil 100% dengan exit code 0, 74/74 rute statis & dinamis ter-compile tanpa error TypeScript atau linting.

7. **Integrity Audit**:
   - Tidak ditemukan hardcoding nilai uji, facade/dummy mock tanpa logika, atau jalan pintas yang melanggar integritas.

---

## 2. Logic Chain

1. Penanganan `datetime-local` dengan `toLocalDatetimeInputString()` menjamin nilai input jam dan menit pada browser admin konsisten dengan UTC ISO string di database PostgreSQL tanpa loncatan offset zona waktu.
2. Validasi dua lapis (client-side di form dan server-side di route handler) mencegah anomali data di mana `closeAt` lebih awal dari `openAt`.
3. Pemeriksaan ketersediaan di sisi frontend (`getExamAvailability` dan `getComputedAvailability`) didukung oleh gating otentik di endpoint `/api/quiz/[quizId]/start`, menjamin keamanan akses dari eksploitasi URL langsung.
4. Logika toleransi attempt aktif (`IN_PROGRESS` / `LOCKED`) memastikan siswa yang sedang mengerjakan ujian saat jam tutup tiba tidak terputus secara mendadak, melainkan tetap mendapatkan hak durasi pengerjaan personal mereka.

---

## 3. Caveats

- Perhitungan countdown di frontend mengandalkan jam lokal perangkat client; namun otoritas validasi akses mutlak tetap dikendalikan oleh server API `/api/quiz/[quizId]/start`.
- Modul ujian tanpa konfigurasi `openAt` dan `closeAt` berstatus fleksibel dan dapat diakses kapan saja sesuai rancangan.

---

## 4. Conclusion

Seluruh deliverable Milestone 1 (Window of Availability Scheduling UI, Status Badges, Runner Availability Gating, Bugfix Timer & Token) telah diuji, diverifikasi, dan memenuhi seluruh kriteria kualitas dan standar proyek VeloNet.

**Final Verdict**: **APPROVE**

---

## 5. Verification Method

1. **Build Verification**:
   ```powershell
   npm run build
   ```
   Hasil: Exit code 0, 74/74 route terkompilasi sukses.

2. **Dialog Compliance Check**:
   ```powershell
   # Verifikasi ketiadaan pemanggilan native alert/confirm/prompt
   ripgrep '\b(alert|confirm|prompt)\s*\(' src/app/admin/exams src/app/student/exams src/app/student/quiz
   ```
   Hasil: Hanya pemanggilan aman terhadap hook `useDialog()`.

3. **Status Badges & Gating Test Cases**:
   - Admin Create / Edit: Set `openAt > closeAt` -> Terbukti diblokir dengan peringatan.
   - Admin List: Modul dengan rentang aktif, mendatang, kedaluwarsa, dan fleksibel menampilkan badge yang sesuai.
   - Student Hub: Menampilkan live countdown untuk ujian mendatang dan menonaktifkan tombol masuk.
   - Student Runner: Membuka ujian mendatang menampilkan layar tunggu dengan countdown 4 kotak; membuka ujian kedaluwarsa menampilkan layar penutupan.
