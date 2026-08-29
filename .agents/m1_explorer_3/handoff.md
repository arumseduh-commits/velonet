# Handoff Report: Window of Availability Scheduling, Student Quiz Runner & Timer Bugfixes

**Agent**: `m1_explorer_3`  
**Working Directory**: `c:\UBIG\VeloNet\.agents\m1_explorer_3`  
**Milestone**: Milestone 1 (Window of Availability Scheduling - Student Quiz Runner & Timer Bugfixes)  
**Date**: 2026-08-30  
**Handoff Type**: Hard (Investigation & Solution Formulation Complete)  

---

## 1. Observation

Direct observations from codebase inspection:

1. **Timer Reset Bug on Reload in `src/app/student/quiz/[quizId]/page.tsx`**:
   - Lines 154-156:
     ```ts
     // Initialize duration timer
     const totalSecs = (qData.durationMinutes || 30) * 60;
     setTimeLeftSeconds(totalSecs);
     ```
   - In `GET /api/quiz/[quizId]/route.ts` (lines 145-149), the backend calculates:
     ```ts
     let remainingDurationSecs: number | null = null;
     if (attempt && attempt.startedAt) {
       const elapsedSecs = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
       remainingDurationSecs = Math.max(0, (quiz.durationMinutes * 60) - elapsedSecs);
     }
     ```
   - However, `page.tsx` line 156 completely ignores `attempt.remainingDurationSecs` and sets `timeLeftSeconds` back to `totalSecs = durationMinutes * 60` on every reload.

2. **Exam Token Payload Mismatch**:
   - In `src/app/student/quiz/[quizId]/page.tsx` (line 291):
     ```ts
     body: JSON.stringify({ examToken: token }),
     ```
   - In `src/app/api/quiz/[quizId]/start/route.ts` (line 97):
     ```ts
     const userToken = (body.token || "").trim().toUpperCase();
     ```
   - In `src/components/exam/ExamPreCheckModal.tsx` (line 193):
     ```tsx
     <button onClick={onStartExam} ...>
     ```
     `onStartExam` was called with 0 arguments, leaving `token` undefined in `handleStartExam(token?: string)` and causing rejection with `"Token ujian yang Anda masukkan salah..."`.

3. **Missing Window Gating Screens in `src/app/student/quiz/[quizId]/page.tsx`**:
   - Lines 141-152 immediately set `setShowPreCheck(true)` when `att` is null, without checking if `now < openAt` or `now > closeAt`.
   - There is no waiting screen with a live ticking countdown for `now < openAt`.
   - There is no expired screen for `now > closeAt`.

4. **Window Availability Gating Rules in `/api/quiz/[quizId]/start/route.ts`**:
   - Lines 55-68 check `if (quiz.openAt && now < new Date(quiz.openAt))` and reject with 403.
   - Lines 80-93 check `if (quiz.closeAt && now > new Date(quiz.closeAt))` and reject with 403 unless `hasActiveAttempt` is true (`IN_PROGRESS` or `LOCKED`), granting full personal timer tolerance.

---

## 2. Logic Chain

1. **Deduction on Timer Reset (Observation 1)**:
   - Because `page.tsx` sets `timeLeftSeconds(totalSecs)` unconditionally at line 156, any refresh of an ongoing attempt resets the client countdown to full time.
   - Using `attempt.remainingDurationSecs` (or computing `durationMinutes * 60 - elapsedSeconds`) when `att.status === "IN_PROGRESS"` guarantees that the student's personal timer accurately reflects actual elapsed time.

2. **Deduction on Token Mismatch (Observation 2)**:
   - `page.tsx` passes `{ examToken: token }` while `start/route.ts` reads `body.token`.
   - Moreover, `ExamPreCheckModal` does not pass `examTokenInput` into `onStartExam`.
   - Unifying the payload to `{ token: tokenToSend, examToken: tokenToSend }` and updating `start/route.ts` to `body.token || body.examToken` completely eliminates any token rejection failure.

3. **Deduction on Window Gating (Observations 3 & 4)**:
   - Checking `now < new Date(quiz.openAt)` when no active attempt exists allows rendering a dedicated "Ujian Belum Dibuka" waiting screen with an active countdown timer that auto-refreshes when `openAt` is reached.
   - Checking `now > new Date(quiz.closeAt)` when no active attempt exists renders a dedicated "Ujian Telah Ditutup" screen.
   - If an attempt is already `IN_PROGRESS` or `LOCKED`, the student bypasses both gating screens and resumes their exam with their remaining personal timer duration.

---

## 3. Caveats

1. **Client Clock Skew**: If a student's local computer clock is slightly desynchronized from the server, the auto-refresh mechanism at countdown `00:00:00` invokes `fetchQuizData()` to re-validate with server time before starting.
2. **Offline Reconnect**: If a student goes offline and returns after their personal timer has elapsed, the timer calculation produces `remainingSecs <= 0`, which automatically triggers `handleAutoSubmitOnTimeout()`.
3. **No other caveats**: The schema and existing API endpoints already supply all necessary fields (`openAt`, `closeAt`, `remainingDurationSecs`).

---

## 4. Conclusion

The exact implementation plan is formulated and ready for execution:
1. Update `src/app/student/quiz/[quizId]/page.tsx`:
   - Add `isUpcoming` waiting screen with a live ticking countdown timer (days, hours, minutes, seconds) and auto-unlock on expiry.
   - Add `isExpired` closed screen with a return button.
   - Fix timer initialization in `fetchQuizData()` to use `att.remainingDurationSecs` for resuming ongoing attempts.
   - Fix token payload in `handleStartExam` to `{ token, examToken }` using `examTokenInput`.
2. Update `src/components/exam/ExamPreCheckModal.tsx` to pass `examTokenInput` to `onStartExam`.
3. Update `src/app/api/quiz/[quizId]/start/route.ts` to accept `body.token || body.examToken`.

---

## 5. Verification Method

To verify the implementation once applied:
1. **Timer Resume Verification**:
   - Start an exam with 30 minutes duration.
   - Wait 1 minute (timer shows 29:00).
   - Refresh the browser page (`F5`).
   - Verify that the timer resumes at 29:00 (or 28:59) and does NOT reset to 30:00.
2. **Token Verification**:
   - Set an exam token (e.g. `VELO1`) on an exam.
   - Open `/student/quiz/[quizId]`, enter `VELO1` in the Pre-Check modal, and click "Mulai Ujian".
   - Verify that the exam starts successfully without 403 token mismatch error.
3. **Upcoming Exam Window Gating**:
   - Create an exam with `openAt` set to 10 minutes in the future.
   - Navigate to `/student/quiz/[quizId]`.
   - Verify that the dedicated "Ujian Belum Dibuka" waiting screen is displayed with an active ticking countdown timer.
4. **Closed Exam Window Gating**:
   - Create an exam with `closeAt` in the past.
   - Navigate to `/student/quiz/[quizId]` as a student who has not started.
   - Verify that the dedicated "Ujian Telah Ditutup" screen is displayed.
5. **Tolerance for In-Progress Attempt**:
   - Start an exam before `closeAt`.
   - Let `closeAt` pass while taking the exam.
   - Refresh the page.
   - Verify that the student can continue working until their personal timer runs out.
6. **Build Verification**:
   - Run `npm run build` or `npx tsc --noEmit` to verify 0 TypeScript/ESLint errors.
