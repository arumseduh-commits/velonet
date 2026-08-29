# Handoff Report — Explorer 2 (UI & Quiz Runner Analysis)

## 1. Observation
1. **Prisma Schema (`prisma/schema.prisma:298-324`)**:
   Model `Quiz` memiliki field `durationMinutes`, `scoreReleaseAt DateTime?`, dll., namun belum memiliki `openAt DateTime?` dan `closeAt DateTime?`.
2. **Admin Exam Form Components (`src/app/admin/exams/create/page.tsx` & `src/app/admin/exams/[quizId]/edit/page.tsx`)**:
   - `create/page.tsx:691` dan `[quizId]/edit/page.tsx:758` menggunakan input standar HTML5 `<input type="datetime-local" ... />` dengan pemotongan string `.substring(0, 16)` untuk `scoreReleaseAt`.
   - `create/page.tsx:403` dan `[quizId]/edit/page.tsx:450` melakukan serialisasi `new Date(scoreReleaseAt).toISOString()`.
   - Belum ada input `openAt` dan `closeAt` di form admin create & edit.
3. **Admin Exam APIs (`src/app/api/admin/exams/route.ts` & `src/app/api/admin/exams/[quizId]/route.ts`)**:
   - `route.ts:71-87` dan `[quizId]/route.ts:64-80` belum mendestrukturisasi `openAt` dan `closeAt`.
4. **Student Exams Page (`src/app/student/exams/page.tsx:208-382`)**:
   - Render kartu ujian saat ini hanya mengecek status `attempt` (`SUBMITTED`, `GRADED`, `DISQUALIFIED`, `LOCKED`, `IN_PROGRESS`).
   - Belum ada logika perbandingan `currentTime` terhadap `openAt` dan `closeAt`, dan belum ada hitung mundur (countdown).
   - `src/app/api/student/exams/route.ts:50-81` belum menyertakan `openAt` dan `closeAt` dalam respons JSON.
5. **Student Quiz Runner (`src/app/student/quiz/[quizId]/page.tsx:154-156`)**:
   - Durasi saat ini langsung diinisialisasi `(qData.durationMinutes || 30) * 60` tanpa menghitung selisih `elapsedSecs` dari `att.startedAt`.
   - Belum ada endpoint `/api/quiz/[quizId]/progress/route.ts` untuk sinkronisasi progress jawaban di background.
   - Pada `src/app/api/quiz/submit/route.ts:23`, validasi mengharuskan `Array.isArray(answers)`, sedangkan Quiz Runner mengirimkan objek `answers: { [qId]: StudentAnswerState }`.
6. **Kepatuhan AGENTS.md**:
   - Pemindaian regex `alert\(|confirm\(|prompt\(` menghasilkan 0 match di seluruh `src/`.
   - `useDialog()` dari `@/components/ui/DialogProvider` digunakan secara seragam di 40+ komponen dan halaman.
   - UI Quiz Runner memiliki navigasi dock bawah responsif seluler (`w-[94%] sm:w-auto max-w-xl fixed bottom-4 left-1/2 -translate-x-1/2`).

## 2. Logic Chain
1. *Dari Observation 1 & 2 & 3*:
   - Menambahkan kolom `openAt DateTime?` dan `closeAt DateTime?` ke `Quiz` di `prisma/schema.prisma` dan menyelaraskannya ke database via `npx prisma db push`.
   - Di `create/page.tsx` dan `[quizId]/edit/page.tsx`, menambahkan state `openAt` & `closeAt` serta sepasang input `<input type="datetime-local" ... />` pada kartu konfigurasi ujian.
   - Menyelaraskan API `/api/admin/exams` (POST, GET) dan `/api/admin/exams/[quizId]` (PATCH, GET) untuk memproses `openAt` dan `closeAt`.
2. *Dari Observation 4*:
   - Di `src/app/api/student/exams/route.ts`, menyertakan `openAt` & `closeAt`.
   - Di `src/app/student/exams/page.tsx`, menambahkan state `currentTime` dengan interval 1 detik untuk menghitung status:
     - `now < openAt && !attempt`: Status "Ujian Belum Dibuka" dengan teks hitung mundur (`Buka dalam: ...`) dan tombol dinonaktifkan.
     - `now > closeAt && !attempt`: Status "Ujian Telah Ditutup / Berakhir" dan tombol dinonaktifkan.
     - `attempt.status === "IN_PROGRESS"`: Status "Sedang Berlangsung" dengan tombol aktif "Lanjutkan Ujian" (toleransi pengerjaan berlaku).
     - `openAt <= now <= closeAt && !attempt`: Status "Tersedia" dengan tombol aktif "Ikuti Ujian".
3. *Dari Observation 5*:
   - Di `GET /api/quiz/[quizId]` dan `POST /api/quiz/[quizId]/start`, tolak akses siswa jika `now < openAt` atau jika `now > closeAt` tanpa attempt aktif.
   - Di `QuizTakingPage`, hitung sisa durasi timer dari `att.startedAt` sehingga siswa yang mulai sebelum `closeAt` tetap mendapatkan hak durasi penuhnya (toleransi).
   - Buat endpoint baru `/api/quiz/[quizId]/progress/route.ts` yang menerima draft jawaban siswa, menghitung skor sementara butir auto-gradable, meng-upsert `QuizStudentAnswer`, dan mengupdate `QuizAttempt.score` & `QuizAttempt.answers`.
   - Di `QuizTakingPage`, tambahkan fungsi debounced (500ms) `triggerBackgroundSync` yang memanggil endpoint progress secara non-blocking setiap kali siswa memilih/mengubah opsi jawaban.
   - Di `/api/quiz/submit/route.ts` dan `/api/quiz/[quizId]/progress/route.ts`, dukung parsing fleksibel untuk `answers` baik bertipe objek dictionary maupun array.

## 3. Caveats
- Timezone browser vs Server: Input `datetime-local` menggunakan zona waktu lokal browser pengguna, dan serialisasi `.toISOString()` mengubahnya ke standar UTC ISO string yang cocok untuk database PostgreSQL.
- Pengerjaan offline: Jika koneksi internet siswa terputus sesaat saat pengerjaan kuis, `localStorage` (`velonet_cbt_draft_${quizId}`) tetap menjaga jawaban siswa secara aman di sisi klien sampai koneksi pulih.

## 4. Conclusion
Arsitektur UI, state form admin, pusat ujian siswa, dan runner CBT siap diintegrasikan dengan penjadwalan rentang waktu (`openAt`/`closeAt`) dan sinkronisasi progress background. Seluruh rancangan mematuhi standar proyek VeloNet (`useDialog`, mobile-first responsive, no native popups).

## 5. Verification Method
1. **Verifikasi Database**: Jalankan `npx prisma db push` setelah menambahkan `openAt` dan `closeAt` pada `prisma/schema.prisma`.
2. **Verifikasi Admin Form**: Buka `/admin/exams/create` dan `/admin/exams/[id]/edit`, setel tanggal `openAt` dan `closeAt`, simpan, dan periksa respons payload di network tab.
3. **Verifikasi Student Exams**: Buka `/student/exams`, pastikan ujian dengan `openAt` di masa depan menampilkan status "Ujian Belum Dibuka" dan hitung mundur aktif, sedangkan ujian yang sudah lewat `closeAt` menampilkan "Ujian Telah Ditutup / Berakhir".
4. **Verifikasi Toleransi Runner & Progress Sync**: Mulai ujian sebelum `closeAt`, uji refresh halaman (sisa durasi pulih tanpa reset), dan periksa panggilan network background ke `/api/quiz/[quizId]/progress` setiap kali opsi jawaban dipilih.
5. **Verifikasi Type-Check & Build**: Jalankan `npm run build` untuk memastikan 0 error TypeScript.
