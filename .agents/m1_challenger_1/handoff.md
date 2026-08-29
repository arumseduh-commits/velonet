# Milestone 1: Challenger Verification & Adversarial Stress-Test Report

**Challenger Agent**: `m1_challenger_1`  
**Verdict**: **APPROVE**  
**Timestamp**: 2026-08-30T02:04:00+07:00  

---

## 1. Observation

A complete empirical and adversarial test suite (`scripts/test-m1-scheduling.ts`) was authored and executed against the implementation of Milestone 1 (Window of Availability Scheduling). The following direct observations and measurements were recorded:

### A. Date Boundary Matrix Observations
1. **Case: `now < openAt` (1s prior / in future)**
   - `src/app/api/quiz/[quizId]/start/route.ts:55`: `if (quiz.openAt && now < new Date(quiz.openAt))` triggers 403 Forbidden with payload `{ success: false, error: "Ujian belum dibuka. Ujian akan dibuka pada ... WIB.", openAt: quiz.openAt }`.
   - `src/app/api/student/exams/route.ts:46`: Evaluates `isUpcoming = true`, assigning `availability = "UPCOMING"`.
   - `src/app/student/quiz/[quizId]/page.tsx:511`: Renders dedicated "Ujian Belum Dibuka" waiting screen with live 4-part countdown (Hari, Jam, Menit, Detik).
   - Test Assertion: **PASS**.

2. **Case: `now === openAt` (Exact start boundary)**
   - Because `now < openAt` evaluates to `false`, boundary access is permitted without off-by-one locking.
   - `availability` evaluates to `"OPEN"`.
   - Test Assertion: **PASS**.

3. **Case: `openAt < now < closeAt` (Within active window)**
   - `availability` evaluates to `"OPEN"`. Start API returns HTTP 200 with new attempt creation and `remainingDurationSecs = durationMinutes * 60`.
   - Test Assertion: **PASS**.

4. **Case: `now === closeAt - 1000ms` (1 second before closeAt)**
   - `now > closeAt` evaluates to `false`. Student is permitted to start exam right before window closes.
   - Test Assertion: **PASS**.

5. **Case: `now === closeAt` (Exact close boundary)**
   - `now > closeAt` evaluates to `false` (strict inequality `>`).
   - Test Assertion: **PASS**.

6. **Case: `now === closeAt + 1000ms` (1 second past closeAt, unstarted)**
   - `src/app/api/quiz/[quizId]/start/route.ts:80`: `if (quiz.closeAt && now > new Date(quiz.closeAt))` and `!hasActiveAttempt` returns HTTP 403 Forbidden with `{ success: false, error: "Waktu pengerjaan ujian telah berakhir / ditutup.", closeAt: quiz.closeAt }`.
   - `src/app/student/quiz/[quizId]/page.tsx:610`: Renders dedicated "Ujian Telah Ditutup / Berakhir" screen.
   - `src/app/student/exams/page.tsx:447`: Action button is disabled with "Telah Ditutup" lock badge.
   - Test Assertion: **PASS**.

7. **Case: `now > closeAt` with Ongoing Active Attempt (`IN_PROGRESS` or `LOCKED`)**
   - `src/app/api/quiz/[quizId]/start/route.ts:81`: `hasActiveAttempt` evaluates to `true`. Start/Resume API returns HTTP 200 with `remainingDurationSecs = Math.max(0, (quiz.durationMinutes * 60) - elapsedSecs)`.
   - `src/app/student/quiz/[quizId]/page.tsx:493`: `hasActiveAttempt` bypasses the expired screen, and the student's personal timer continues ticking down with full tolerance.
   - Test Assertion: **PASS**.

8. **Case: `openAt === null && closeAt === null` (Flexible Access)**
   - Evaluated as `availability = "OPEN"`, and status badge displays "Akses Fleksibel" on Admin dashboard.
   - Test Assertion: **PASS**.

### B. Chronological Validation (`openAt >= closeAt`) Observations
1. **Frontend Create & Edit Forms**:
   - `src/app/admin/exams/create/page.tsx:394`: Form validation blocks save with `toast.warning("Jadwal tutup ujian (closeAt) harus lebih akhir dari jadwal buka ujian (openAt)!")` if `openTime >= closeTime`.
   - `src/app/admin/exams/[quizId]/edit/page.tsx:394`: Identical chronological client-side check.
2. **Backend APIs**:
   - `src/app/api/admin/exams/route.ts:107`: POST route validates `if (parsedOpenAt && parsedCloseAt && parsedOpenAt >= parsedCloseAt)` returning HTTP 400 Bad Request.
   - `src/app/api/admin/exams/[quizId]/route.ts:99`: PATCH route validates effective dates returning HTTP 400 Bad Request.
   - Test Assertion: **PASS**.

### C. Timezone & Datetime String Observations
1. **Local Datetime String Helper**:
   - `toLocalDatetimeInputString(isoDateStr)` converts UTC ISO strings (e.g. `2026-08-30T10:00:00.000Z`) to local calendar components `YYYY-MM-DDTHH:mm`.
   - Handles `null`, `undefined`, empty string `""`, and invalid strings safely by returning `""`.
   - Preserves leap year dates (`2028-02-29`) and enforces zero-padding (`01-05T04:03`).
   - Test Assertion: **PASS**.

### D. Live Database Schema Persistence Observations
1. **PostgreSQL & Prisma Client**:
   - Model `Quiz` in `prisma/schema.prisma` contains `openAt DateTime?` and `closeAt DateTime?`.
   - Created live test record (ID: `737f39bd-4a01-4fb9-a9a9-7ba895ec9ae5`), read back fields, updated schedule dates, and deleted with cascade without schema or constraint errors.
   - Test Assertion: **PASS**.

---

## 2. Logic Chain

1. **Security & Gating Equivalence**: The backend API (`/api/quiz/[quizId]/start`) and the student UI (`/student/quiz/[quizId]` & `/student/exams`) enforce identical boundary semantics: `now < openAt` for upcoming exams, and `now > closeAt` for closed exams. Thus, bypassing the UI via direct curl/fetch requests to the start endpoint is strictly blocked with HTTP 403.
2. **Fairness & Personal Duration Tolerance**: Students who enter the exam at `11:59` when `closeAt` is `12:00` for a 30-minute exam have an active attempt created before `closeAt`. When resuming or working past `12:00`, `hasActiveAttempt` is true on both the API and client runner, allowing the student their full remaining personal duration (`max(0, 1800 - elapsed)`).
3. **Timezone Integrity**: By transforming ISO 8601 database timestamps to local datetime strings via `toLocalDatetimeInputString()`, the `<input type="datetime-local">` fields correctly display the user's local timezone (e.g., WIB UTC+7) without unexpected +07:00 / -07:00 drift when opening the edit form.
4. **Resilience to Invalid Schedules**: Both client and server reject `openAt >= closeAt` with descriptive warnings / HTTP 400, preventing inverted availability windows.

---

## 3. Caveats

1. **Client System Clock Tampering**: The client runner uses `now = new Date()` for UI countdowns and displaying the waiting screen. However, all actual authorization, attempt creation, and remaining duration calculations are verified server-side on `/api/quiz/[quizId]/start` using server time (`new Date()`). Tampering with client clock does not grant unauthorized exam access.
2. **No caveats found**: All acceptance criteria for Milestone 1 are verified and fully met.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 1 successfully delivers:
- Robust Window of Availability scheduling with `openAt` and `closeAt` on `Quiz`.
- Rock-solid boundary behavior (exact equality, 1s deltas, past, future).
- Comprehensive gating on both backend Start API and frontend runner with dedicated waiting/expired screens.
- Full personal duration tolerance for ongoing attempts.
- Accurate timezone handling and input formatting for datetime-local controls.
- Chronological validation (`openAt < closeAt`) across UI and REST endpoints.
- 0 TypeScript / Build errors.

---

## 5. Verification Method

To independently execute and verify the empirical test suite:
```powershell
npx --yes tsx scripts/test-m1-scheduling.ts
```
Expected output:
```text
=======================================================
EMPIRICAL TEST SUMMARY
=======================================================
Total Tests Run : 47
Passed          : 47
Failed          : 0

>>> ALL EMPIRICAL CHALLENGER TESTS PASSED (100%)! <<<
```
