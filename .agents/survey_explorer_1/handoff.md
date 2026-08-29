# Handoff Report — survey_explorer_1

## 1. Observation

### Observation 1.1: Skema Prisma & Model Database (`prisma/schema.prisma`)
- Model `Quiz` (baris 298-328) telah memiliki kolom `openAt DateTime?` dan `closeAt DateTime?` di samping kolom konfigurasi durasi dan keamanan (`durationMinutes Int @default(30)`, `enableFullscreenLock`, `enableTabSwitchDetect`, `maxStrikes`, `enableCameraProctor`, `supervisorPin`, `examToken`, `showScoreImmediately`, `scoreReleaseAt`, `showDiscussion`).
- Model `Question` (baris 330-351) dan `Option` (baris 353-359) mendukung 5 tipe soal (`SINGLE_CHOICE`, `CHECKBOXES`, `TRUE_FALSE`, `SHORT_ANSWER`, `ESSAY`).
- Model `QuizAttempt` (baris 361-389), `QuizStudentAnswer` (baris 391-417), dan `ExamViolationLog` (baris 419-429) mencatat status pengerjaan (`IN_PROGRESS`, `LOCKED`, `SUBMITTED`, `GRADED`, `DISQUALIFIED`), poin jawaban, skor kumulatif realtime, dan log pelanggaran.
- Model `User` (baris 16-49) menyimpan kelas siswa pada field `studentClass String?` (tidak ada tabel terpisah untuk Class/Grade).

### Observation 1.2: Form Pembuatan Ujian (`src/app/admin/exams/create/page.tsx`)
- Baris 119-133: State lokal mengelola `title`, `description`, `durationMinutes`, `enableFullscreenLock`, `enableTabSwitchDetect`, `maxStrikes`, `enableCameraProctor`, `supervisorPin`, `shuffleQuestions`, `shuffleOptions`, `examToken`, `showScoreImmediately`, `scoreReleaseAt`, `showDiscussion`. State `openAt` dan `closeAt` belum ada.
- Baris 391-411: Fungsi `handleSaveExam` menyusun payload POST tanpa menyertakan `openAt` dan `closeAt`.
- Baris 507-580: Form UI "Informasi & Pengaturan Ujian" belum memiliki komponen `<input type="datetime-local" />` untuk waktu buka dan tutup ujian.

### Observation 1.3: Form Pengeditan Ujian (`src/app/admin/exams/[quizId]/edit/page.tsx`)
- Baris 127-141: State lokal belum memiliki `openAt` dan `closeAt`.
- Baris 150-166: `useEffect` pemanggilan `GET /api/admin/exams/[quizId]` belum menyetel nilai `openAt` dan `closeAt` ke state formulir.
- Baris 438-458: Fungsi `handleSaveExam` menyusun payload PATCH tanpa properti `openAt` dan `closeAt`.

### Observation 1.4: Endpoint API Admin Exam (`src/app/api/admin/exams/route.ts` & `[quizId]/route.ts`)
- `src/app/api/admin/exams/route.ts`:
  - Baris 39-40: `GET` mengembalikan `openAt` dan `closeAt` dalam format ISO string atau `null`.
  - Baris 76-77, 98-112: `POST` menerima `openAt` dan `closeAt`, melakukan parsing `new Date(...)`, memvalidasi tanggal tidak `NaN`, dan memastikan `parsedOpenAt < parsedCloseAt`.
- `src/app/api/admin/exams/[quizId]/route.ts`:
  - Baris 67-68, 90-104: `PATCH` menerima `openAt` dan `closeAt`, memvalidasi tanggal secara konsisten dengan data eksisting/baru, dan melakukan `prisma.quiz.update`.

### Observation 1.5: Dashboard Pengawas Realtime (`src/app/admin/exams/[quizId]/proctor/page.tsx`)
- Polling otomatis aktif setiap 3.5 detik (baris 59-66) memanggil `GET /api/admin/exams/[quizId]/proctor`.
- Menampilkan metrik ringkasan kartu dan tabel daftar siswa dengan tombol kontrol pengawas (`UNLOCK`, `RESET_STRIKES`, `FORCE_SUBMIT`, `DISQUALIFY`).
- Belum memiliki visualisasi Podium Top 3 Gamifikasi ala Quizizz, progress bar per butir soal, dan filter dropdown kelas (`studentClass`).

### Observation 1.6: Runner & Progress Sync Siswa (`src/app/api/quiz/[quizId]/progress/route.ts` & `src/app/student/quiz/[quizId]/page.tsx`)
- Endpoint `POST /api/quiz/[quizId]/progress` telah siap dengan sinkronisasi 3 tingkat (backup JSON map, upsert `QuizStudentAnswer`, dan update realtime `QuizAttempt.score`).
- Di runner siswa (`src/app/student/quiz/[quizId]/page.tsx`), perlu dipastikan pemanggilan `fetch('/api/quiz/' + quizId + '/progress')` otomatis dipicu di latar belakang (non-blocking) saat siswa memilih opsi jawaban.

---

## 2. Logic Chain

1. **Dari Observasi 1.1 & 1.4**: Skema database dan endpoint API Admin (`/api/admin/exams` & `[quizId]`) sudah dirancang untuk mendukung `openAt` dan `closeAt` bertipe `DateTime?` dengan validasi urutan waktu (`openAt < closeAt`).
2. **Dari Observasi 1.2 & 1.3**: Kesenjangan (gap) utama pada penjadwalan waktu ujian terletak pada UI layer Admin:
   - Form `create/page.tsx` dan `edit/page.tsx` belum memiliki state lokal, komponen input `datetime-local`, dan pengiriman field `openAt` serta `closeAt` pada payload API.
3. **Dari Observasi 1.5**: Dashboard proctoring admin `/admin/exams/[quizId]/proctor` telah memiliki fondasi live polling dan aksi kontrol pengawas, namun perlu ditingkatkan untuk memenuhi Requirement R2:
   - Menambahkan Podium Gamifikasi Top 3 bergerak dinamis ala Quizizz.
   - Menampilkan visual progress bar pengerjaan soal dan skor realtime yang bertambah dinamis.
   - Menambahkan filter dropdown Kelas (`User.studentClass`) dan opsi sorting (Skor Tertinggi, Paling Cepat, Pelanggaran Terbanyak).
4. **Dari Observasi 1.6**: Sinkronisasi progress cepat (R3) telah didukung oleh backend `/api/quiz/[quizId]/progress` dan dapat langsung dihubungkan ke interaksi klik jawaban di runner ujian siswa.

---

## 3. Caveats

- **Timezone Handling**: Input `<input type="datetime-local">` menggunakan zona waktu lokal browser (WIB / UTC+7). Saat dikonversi via `new Date(val).toISOString()`, nilai akan tersimpan dalam standar UTC di PostgreSQL, yang konsisten dengan pembacaan server.
- **Nullability**: Baik `openAt` maupun `closeAt` bersifat nullable. Jika dikosongkan (`null`), sistem harus menganggap ujian terbuka secara fleksibel tanpa pembatasan waktu.

---

## 4. Conclusion

Arsitektur sistem VeloNet siap untuk implementasi lengkap Penjadwalan Waktu Ujian (R1), Live Proctor Leaderboard (R2), dan Fast Progress Sync (R3):
1. **Model Prisma**: Sudah memiliki kolom `openAt` dan `closeAt` pada model `Quiz`.
2. **Admin Forms**: Perlu penambahan state, kontrol input `datetime-local`, validasi client-side, dan pengiriman payload di `create/page.tsx` dan `edit/page.tsx`.
3. **Admin Proctor Dashboard**: Perlu penambahan komponen Podium Top 3 Gamifikasi, progress bar per siswa, skor realtime dinamis, serta filter kelas dan sorting.
4. **Student Runner**: Perlu pemastian countdown pada status `UPCOMING`, penolakan pada status `CLOSED`, toleransi timer personal jika mulai sebelum `closeAt`, dan sinkronisasi progress cepat ke API progress.

---

## 5. Verification Method

1. **Inspeksi Skema & Database**:
   - Jalankan `npx prisma db push` untuk memverifikasi keselarasan skema database PostgreSQL.
2. **Inspeksi Form Admin (`/admin/exams/create` & `/admin/exams/[quizId]/edit`)**:
   - Buka form pembuatan ujian, set `openAt` dan `closeAt`, simpan, dan periksa apakah nilai tersimpan via `GET /api/admin/exams/[quizId]`.
   - Buka form edit ujian, verifikasi nilai tanggal muncul pada input `datetime-local`, ubah tanggal, simpan, dan pastikan data diperbarui.
3. **Inspeksi Dashboard Pengawas (`/admin/exams/[quizId]/proctor`)**:
   - Buka halaman proctor, verifikasi podium 3 besar, filter kelas, progress bar, skor realtime, dan fungsi kontrol pengawas (Unlock, Force Submit, Kick).
4. **Typecheck & Build**:
   - Jalankan `npm run build` untuk memverifikasi 0 TypeScript error dan build Next.js 100% sukses.
