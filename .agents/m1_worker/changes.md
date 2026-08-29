# Milestone 1: Changes Specification

## Summary of Completed Tasks

### 1. Database Schema Sync
- Verified database sync against `prisma/schema.prisma` via `npx prisma db push`.
- Columns `openAt DateTime?` and `closeAt DateTime?` on model `Quiz` are active and synced.

### 2. Admin Exam UI: Creation & Editing
- **`src/app/admin/exams/create/page.tsx`**:
  - Added chronological client-side validation (`openAt < closeAt`) in `handleSaveExam` with `toast.warning()`.
  - Added clear buttons (`Hapus Jadwal` & `Hapus Batas`) for `openAt` and `closeAt` `<input type="datetime-local">` fields.
  - Added valid duration preview pill and inline warning banner when `openAt >= closeAt`.
  - Maintained payload structure for `openAt` and `closeAt`.
- **`src/app/admin/exams/[quizId]/edit/page.tsx`**:
  - Implemented `toLocalDatetimeInputString()` helper function to safely convert UTC ISO dates to local datetime input strings (`YYYY-MM-DDTHH:mm`), preventing timezone shift on edit/save.
  - Added client-side chronological validation in `handleSaveExam`.
  - Added clear buttons, duration preview badge, and inline warning alert.
  - Initialized `openAt`, `closeAt`, and `scoreReleaseAt` via `toLocalDatetimeInputString()`.
- **`src/app/admin/exams/page.tsx`**:
  - Added `formatIndonesianDateTime()` and `getExamAvailability()` helpers.
  - Added visual availability status badges: "Sedang Berlangsung" (Active green), "Terjadwal" (Upcoming amber), "Telah Berakhir" (Closed rose), "Akses Fleksibel" (Slate).
  - Added schedule date display section ("Buka: ..." and "Tutup: ...") to each exam card.

### 3. Student Exam Hub
- **`src/app/student/exams/page.tsx`**:
  - Fixed syntax error with stray closing `</div>` tags.
  - Implemented 1-second live ticking clock (`now`) for real-time countdown calculation.
  - Added formatted countdown badges for upcoming exams (`formatCountdown()`), showing "Dibuka dalam: HH:mm:ss" or days remaining.
  - Added availability badges ("Ujian Belum Dibuka", "Sedang Berlangsung", "Ujian Telah Ditutup", "Sedang Dikerjakan", "Terkunci Pelanggaran", "Didiskualifikasi", "Selesai Dikerjakan").
  - Configured disabled state and lock/clock icons for unopened and closed exams.
  - Refined tab filter counts and logic for `ALL`, `ACTIVE`, and `COMPLETED`.
  - Ensured 100% mobile responsiveness (<640px) with responsive wrapping, overflow handling, and touch-target padding.

### 4. Student Quiz Runner & Bug Fixes
- **`src/app/student/quiz/[quizId]/page.tsx`**:
  - **Upcoming Gating**: Rendered dedicated "Ujian Belum Dibuka" waiting screen when `now < openAt` with live ticking countdown (Days, Hours, Minutes, Seconds) and auto-unlock upon expiration.
  - **Expired Gating**: Rendered dedicated "Ujian Telah Ditutup / Berakhir" screen when `now > closeAt` for unstarted exams.
  - **Personal Timer Tolerance**: Active attempts (`IN_PROGRESS` or `LOCKED`) bypass gating and continue with their personal remaining time even past `closeAt`.
  - **Timer Reset Bug Fix**: In `fetchQuizData()`, ongoing attempts initialize `timeLeftSeconds` from `att.remainingDurationSecs` (or elapsed time calculation) instead of resetting back to full duration. If remaining duration is 0, auto-submit is triggered.
  - **Exam Token Bug Fix**: `handleStartExam` reads `(token || examTokenInput)` and transmits `{ token: tokenToSend, examToken: tokenToSend }`. Timer is updated with `remainingDurationSecs` from API response.
- **`src/components/exam/ExamPreCheckModal.tsx`**:
  - Updated `onStartExam` prop signature to `(token?: string) => void`.
  - Passed `examTokenInput` to `onStartExam(examTokenInput)` on start button click.
- **`src/app/api/quiz/[quizId]/start/route.ts`**:
  - Updated token parsing to accept both `body.token` and `body.examToken`.

### 5. UI/UX & Integrity Standards
- Strict usage of `useDialog()` from `@/components/ui/DialogProvider` (no native alert/confirm/prompt).
- Fully responsive across mobile (<640px) and desktop viewports.
- Genuine business logic and state management without hardcoding or shortcuts.

### 6. Build & Verification
- `npm run build` completed with 0 errors (74/74 static/dynamic pages compiled successfully).
