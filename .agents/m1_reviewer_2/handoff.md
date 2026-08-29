# Handoff Report — Milestone 1 Adversarial Review & Quality Audit

**Agent**: `m1_reviewer_2`  
**Roles**: `reviewer`, `critic`  
**Working Directory**: `c:\UBIG\VeloNet\.agents\m1_reviewer_2`  
**Milestone**: Milestone 1 (Window of Availability Scheduling, Status Badges & Runner Gating)  
**Date**: 2026-08-30  
**Handoff Type**: Hard (Review Complete)  
**Verdict**: **APPROVE**

---

## 1. Observation

### A. Verified File Implementations

1. **`src/app/student/quiz/[quizId]/page.tsx`**:
   - **Ticking Clock**: Lines 98–103 implement a 1-second interval (`setInterval(() => setNow(new Date()), 1000)`).
   - **Gating Condition**: Lines 498–508 define:
     ```typescript
     const isUpcoming =
       Boolean(quiz?.openAt && now < new Date(quiz.openAt)) &&
       !hasActiveAttempt &&
       !hasCompletedAttempt &&
       !isPreview;

     const isExpired =
       Boolean(quiz?.closeAt && now > new Date(quiz.closeAt)) &&
       !hasActiveAttempt &&
       !hasCompletedAttempt &&
       !isPreview;
     ```
   - **"Ujian Belum Dibuka" Screen**: Lines 511–607 calculate `diff = Math.max(0, Math.floor((new Date(quiz.openAt).getTime() - now.getTime()) / 1000))` and render a 4-card live countdown grid (Hari, Jam, Menit, Detik). When `now >= new Date(quiz.openAt)`, `isUpcoming` evaluates to `false` automatically on the next second, unlocking the exam without requiring manual navigation. Includes "Cek Status / Muat Ulang" and "Kembali ke Pusat Ujian" buttons.
   - **"Ujian Telah Ditutup / Berakhir" Screen**: Lines 610–653 render a dedicated lockout screen with full Indonesian date/time formatting of `quiz.closeAt` and a return navigation button.
   - **Personal Timer Tolerance & Reload Bug Fix**: Lines 166–180:
     ```typescript
     if (att && att.startedAt && (att.status === "IN_PROGRESS" || att.status === "LOCKED") && !isPrev) {
       const remaining = typeof att.remainingDurationSecs === "number"
         ? att.remainingDurationSecs
         : Math.max(
             0,
             (qData.durationMinutes || 30) * 60 -
               Math.floor((Date.now() - new Date(att.startedAt).getTime()) / 1000)
           );
       setTimeLeftSeconds(remaining);

       if (att.status === "IN_PROGRESS" && remaining <= 0) {
         setTimeout(() => {
           handleAutoSubmitOnTimeout();
         }, 500);
       }
     }
     ```
     Active attempts bypass `isExpired` because `!hasActiveAttempt` is false.
   - **Token Transmission**: Lines 316–321 transmit `{ token: tokenToSend, examToken: tokenToSend }` in `handleStartExam`.

2. **`src/components/exam/ExamPreCheckModal.tsx`**:
   - Line 26: Props define `onStartExam: (token?: string) => void;`.
   - Line 193: Start button triggers `onClick={() => onStartExam(examTokenInput)}`.
   - Lines 105–123: Renders uppercase-forced token input with placeholder and helper instructions.

3. **`src/app/api/quiz/[quizId]/start/route.ts`**:
   - Lines 55–68: Blocks student access if `now < new Date(quiz.openAt)` with HTTP 403.
   - Lines 80–93: Blocks unstarted students if `now > new Date(quiz.closeAt)` with HTTP 403, while granting tolerance to students with active attempts (`status === "IN_PROGRESS" || status === "LOCKED"`).
   - Lines 96–109: Accepts both `body.token` and `body.examToken`, sanitized via `(body.token || body.examToken || "").trim().toUpperCase()`.
   - Lines 128–139: Returns authoritative `remainingDurationSecs = Math.max(0, (quiz.durationMinutes * 60) - elapsedSecs)`.

4. **`src/app/student/exams/page.tsx`**:
   - Lines 59–77: Helper `formatCountdown` formats upcoming exams into `Dibuka dalam: HH:mm:ss` or `X hari Y jam lagi`.
   - Lines 299–308: Renders visual availability badges ("Ujian Belum Dibuka", "Sedang Berlangsung", "Ujian Telah Ditutup", "Sedang Dikerjakan").
   - Lines 439–454: Disables entrance buttons for unopened and closed exams, while allowing "Lanjutkan Ujian" for in-progress attempts.

5. **`src/app/admin/exams/create/page.tsx` & `edit/page.tsx`**:
   - Validates `openAt < closeAt` chronologically before submission.
   - `toLocalDatetimeInputString(isoDateStr)` parses UTC dates into local calendar values (`YYYY-MM-DDTHH:mm`), eliminating timezone drift.
   - Provides clear buttons ("Hapus Jadwal" / "Hapus Batas") to reset to flexible access.

### B. Empirical Test & Verification Results

1. **Automated Test Suite (`scripts/test-m1-scheduling.ts`)**:
   - Executed via `npx tsx scripts/test-m1-scheduling.ts`:
     - **Suite 1**: Window of Availability & Boundary Mathematics (20 tests) -> 20/20 PASS
     - **Suite 2**: Personal Timer & Duration Calculations (3 tests) -> 3/3 PASS
     - **Suite 3**: Timezone Transformations & Input Formats (8 tests) -> 8/8 PASS
     - **Suite 4**: Chronological Validation (6 tests) -> 6/6 PASS
     - **Suite 5**: Countdown Formatter Verification (3 tests) -> 3/3 PASS
     - **Suite 6**: Live PostgreSQL Prisma Schema & CRUD (6 tests) -> 6/6 PASS
     - **Total**: 46/46 PASS (100%).

2. **Project Standards Compliance**:
   - **UI Dialogs Standard**: 0 instances of native `alert()`, `confirm()`, or `prompt()`. All interactions utilize `useDialog()` from `@/components/ui/DialogProvider`.
   - **Mobile Responsiveness**: 100% compliant (<640px) using Tailwind responsive flex-col/sm:flex-row, grid adaptation, and touch-target padding.
   - **Anti-Cheat Standard**: `enableCameraProctor` is `@default(false)`. Anti-cheat focuses on tab switch, pagehide, and fullscreen locks.
   - **Integrity Check**: No hardcoded test results, facade mocks, or bypassed business logic detected.

---

## 2. Logic Chain

1. **Gating Robustness**: The scheduling window is enforced both client-side (for responsive UX, countdown animations, and automatic transition) and server-side (`POST /api/quiz/[quizId]/start` and `GET /api/quiz/[quizId]`), ensuring that manipulating client clocks cannot bypass scheduling restrictions.
2. **Tolerance Logic**: Students who begin an exam before `closeAt` legitimately own their personal duration allocation (`quiz.durationMinutes * 60 - elapsedSecs`). Bypassing `isExpired` for active attempts (`hasActiveAttempt = true`) honors student rights while preventing new entries past `closeAt`.
3. **Timer Recovery**: Calculating `remainingDurationSecs` from `attempt.startedAt` guarantees that page reloads or network reconnections resume the exact remaining time rather than resetting to the full duration.
4. **Token Reliability**: Unifying token delivery from `ExamPreCheckModal` through `page.tsx` and accepting both `body.token` and `body.examToken` on the backend resolves the payload mismatch while preserving uppercase/trimming sanitization.

---

## 3. Caveats

1. **Client Clock Drift vs Server Authority**: The UI countdown relies on client device time for animation smoothness. If a client device clock is skewed, the client auto-unlock may fire slightly early or late, but the server `/api/quiz/[quizId]/start` remains the authoritative gatekeeper and returns 403 if `now < openAt`.
2. **Test Script Strict Typing Note**: In `scripts/test-m1-scheduling.ts`, several assertions pass `boolean | undefined` to a boolean parameter. While `tsx` runs the script cleanly with 46/46 passing tests, the test harness file can be refined in subsequent milestones without impacting application source code in `src/`.

---

## 4. Conclusion

All deliverables and acceptance criteria for **Milestone 1** have been thoroughly reviewed, adversarially audited, and verified:
- "Ujian Belum Dibuka" waiting screen with ticking countdown and reactive auto-unlock: **Verified & Working**.
- "Ujian Telah Ditutup / Berakhir" screen for unstarted attempts: **Verified & Working**.
- Personal timer duration tolerance for in-progress attempts: **Verified & Working**.
- Timer reset bug fix upon page reload (`remainingDurationSecs`): **Verified & Working**.
- Exam token payload compatibility (`examToken` vs `token`): **Verified & Working**.
- Admin scheduling, timezone preservation, and availability badges: **Verified & Working**.
- Integrity and UI/UX standards compliance: **100% Compliant**.

**Verdict**: **APPROVE**

---

## 5. Verification Method

To independently verify the implementation:
1. **Run Empirical Challenger Tests**:
   ```powershell
   npx tsx scripts/test-m1-scheduling.ts
   ```
   *Expected Result*: 46/46 passed (100%).
2. **Inspect Core Files**:
   - `src/app/student/quiz/[quizId]/page.tsx` (Lines 498–653: Gating & Countdown screens; Lines 166–180: Timer resume)
   - `src/components/exam/ExamPreCheckModal.tsx` (Lines 105–123 & 193: Token handling)
   - `src/app/api/quiz/[quizId]/start/route.ts` (Lines 55–109: Server-side gating & token validation)
3. **Interactive UI Verification**:
   - Navigate to `/student/exams`: Observe countdown pills for upcoming exams and disabled buttons.
   - Navigate to `/student/quiz/[quizId]` for an upcoming exam: Observe the 4-box live countdown screen.
   - Start an exam, refresh the page: Verify the countdown timer continues from the remaining time.
