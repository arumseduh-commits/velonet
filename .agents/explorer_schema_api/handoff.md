# Handoff Report — Explorer 1 (Schema & API Specialist)

## 1. Observation
- **`prisma/schema.prisma`**:
  - `model Quiz` (Baris 298–324): Tidak memiliki kolom `openAt` dan `closeAt`. Relasi ke `questions Question[]` dan `attempts QuizAttempt[]`.
  - `model QuizAttempt` (Baris 358–385): Menyimpan `score`, `totalScore`, `status`, `strikeCount`, `answers` (JSON string), `startedAt`, `submittedAt`.
  - `model QuizStudentAnswer` (Baris 387–413): Memiliki `@@unique([attemptId, questionId])` dengan field `selectedOptionIds`, `textResponse`, `earnedPoints`, `isAutoGraded`.
- **API Admin Ujian**:
  - `src/app/api/admin/exams/route.ts`: Handler `GET` (baris 5–61) & `POST` (baris 63–151). Tidak menangani `openAt` dan `closeAt`.
  - `src/app/api/admin/exams/[quizId]/route.ts`: Handler `PATCH` (baris 51–170). Tidak menangani update `openAt` dan `closeAt`.
- **API Siswa & Runner**:
  - `src/app/api/student/exams/route.ts`: Handler `GET` (baris 7–94). Belum mengekspos `openAt`, `closeAt`, atau status ketersediaan (*availability*).
  - `src/app/api/quiz/[quizId]/start/route.ts`: Handler `POST` (baris 6–105). Belum memverifikasi jendela waktu `openAt` dan `closeAt`.
  - `src/app/api/quiz/submit/route.ts`: Handler `POST` (baris 8–244).
- **Proctoring API**:
  - `src/app/api/admin/exams/[quizId]/proctor/route.ts`: Handler `GET` (baris 5–97). Mengembalikan `quiz`, `stats`, dan `attempts` dengan log pelanggaran.
  - `src/app/api/admin/exams/[quizId]/action/route.ts`: Handler `POST` (baris 5–157). Menangani `UNLOCK`, `RESET_STRIKES`, `FORCE_SUBMIT`, dan `DISQUALIFY`.

## 2. Logic Chain
1. **Window of Availability**:
   - Menambahkan `openAt DateTime?` dan `closeAt DateTime?` pada `model Quiz` di `schema.prisma` memungkinkan penyimpanan rentang waktu ujian yang fleksibel di database PostgreSQL.
   - Mengintegrasikan parsing date pada `POST /api/admin/exams` dan `PATCH /api/admin/exams/[quizId]` menjamin data tersimpan dengan benar saat admin membuat atau mengedit ujian.
   - Pada `POST /api/quiz/[quizId]/start`, membandingkan `now < openAt` menghasilkan penolakan 403 jika ujian belum dibuka, dan `now > closeAt` (jika belum mulai) menghasilkan penolakan 403 jika ujian sudah ditutup. Siswa yang sudah mulai sebelum `closeAt` tetap dapat menyelesaikan sisa durasi personalnya.
2. **Fast Progress Sync (`/api/quiz/[quizId]/progress`)**:
   - Siswa mengirimkan perubahan jawaban secara berkala. Backend melakukan `upsert` pada `QuizStudentAnswer` (berdasarkan `[attemptId, questionId]`) dan memperbarui nilai `QuizAttempt.score` sementara.
   - Ini memungkinkan pembaruan skor live yang sangat efisien tanpa *table lock* atau contention tinggi.
3. **Live Proctoring Leaderboard ala Quizizz**:
   - Frontend `/admin/exams/[quizId]/proctor` melakukan polling setiap 3 detik ke `GET /api/admin/exams/[quizId]/proctor`.
   - Data diperkaya dengan persentase progres, jumlah soal terjawab, skor realtime, indikator strike (kuning/merah), dan pengurutan dinamis untuk Top 3 Podium (Emas, Perak, Perunggu).
   - Seluruh aksi pengawas (*Unlock*, *Force Submit*, *Kick*) memanggil `POST /api/admin/exams/[quizId]/action` dengan proteksi dialog `useDialog`.

## 3. Caveats
- Perubahan `schema.prisma` memerlukan eksekusi `npx prisma db push` untuk memperbarui skema PostgreSQL lokal/server.
- Pada `POST /api/quiz/submit`, payload `answers` dari client harus dinormalisasi jika dikirim dalam bentuk objek key-value `{ [questionId]: answer }` maupun array `[ { questionId, ... } ]`.

## 4. Conclusion
Semua titik integrasi (Database schema, Admin Exam APIs, Student Runner APIs, Fast Progress Sync endpoint, dan Live Proctor Leaderboard) telah dipetakan secara lengkap dan siap untuk diimplementasikan oleh tim developer tanpa ada ambiguitas arsitektur. Laporan detail tersedia di `c:\UBIG\VeloNet\.agents\explorer_schema_api\report.md`.

## 5. Verification Method
- Validasi Skema: `npx prisma db push`
- Validasi Linting & Type Check: `npm run build`
- Pemeriksaan File:
  - `prisma/schema.prisma`
  - `src/app/api/admin/exams/route.ts`
  - `src/app/api/admin/exams/[quizId]/route.ts`
  - `src/app/api/admin/exams/[quizId]/proctor/route.ts`
  - `src/app/api/student/exams/route.ts`
  - `src/app/api/quiz/[quizId]/start/route.ts`
  - `src/app/api/quiz/[quizId]/progress/route.ts`
