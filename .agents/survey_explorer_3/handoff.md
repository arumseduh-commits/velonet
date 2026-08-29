# Handoff Report — survey_explorer_3: Realtime Live Proctor & Gamified Leaderboard

## 1. Observation

1. **Target Page & Existing Implementation**:
   - `src/app/admin/exams/[quizId]/proctor/page.tsx` (Lines 58-66): Currently uses an interval of 3500ms instead of 3000ms:
     ```ts
     const interval = setInterval(() => {
       fetchProctorData(false);
     }, 3500);
     ```
   - Score column (Lines 387-394) currently only shows score when `status === 'SUBMITTED'`:
     ```tsx
     {att.status === "SUBMITTED" ? (
       <div className="font-bold text-slate-900 text-sm">
         {att.score} <span className="text-slate-400 font-normal text-xs">/ {att.totalScore}</span>
       </div>
     ) : (
       <span className="text-slate-400 text-xs">-</span>
     )}
     ```
   - Lacks a Top 3 Gamified Podium (Gold, Silver, Bronze) with dynamic rank transitions ala Quizizz.
   - Lacks per-question dots/indicators (only shows simple stats or overall progress).
   - Lacks Class Filter dropdown and multi-field sorting (Highest Score, Fastest Progress, Most Strikes, Name A-Z).

2. **Proctor API Route**:
   - `src/app/api/admin/exams/[quizId]/proctor/route.ts` (Lines 17-24 & 60-95): Fetches attempts and detailedAnswers, but does not sort questions by `order: 'asc'` nor include `answeredQuestionIds` in the formatted attempt payload.

3. **Proctor Action API Route**:
   - `src/app/api/admin/exams/[quizId]/action/route.ts` (Lines 44-146): Implements `UNLOCK`, `RESET_STRIKES`, `FORCE_SUBMIT`, and `DISQUALIFY` with `ExamViolationLog` audit trails.

4. **Student Background Progress API**:
   - `src/app/api/quiz/[quizId]/progress/route.ts` (Lines 6-210): Upserts `QuizStudentAnswer` with `earnedPoints` and updates `QuizAttempt.score` in real time.
   - `src/app/student/quiz/[quizId]/page.tsx` (Lines 293-326): Option click handlers do not currently call `/api/quiz/[quizId]/progress` in the background.

5. **UI/UX Standards (`c:\UBIG\VeloNet\AGENTS.md`)**:
   - Strictly prohibits native `alert()`, `confirm()`, `prompt()`.
   - Requires custom UI Dialogs (`useDialog()` from `@/components/ui/DialogProvider`).
   - Requires 100% mobile responsiveness (< 640px) with `flex-col sm:flex-row`, `overflow-x-auto` on tables, and responsive cards.

---

## 2. Logic Chain

1. **Realtime Polling (Step 1)**:
   - Setting `setInterval` to 3000ms (3s) with an `isFetching` guard ensures constant live updates without request stacking.
2. **Quizizz-Style Top 3 Podium (Step 2)**:
   - Deriving top 3 ranked participants from `attempts` (sorted by score descending) enables rendering the Olympic 2-1-3 podium.
   - Comparing current rankings with `prevRanksMap` detects position movement (`↑`, `↓`, `=`) for dynamic gamified transitions.
3. **Per-Question Progress & Realtime Scores (Step 3)**:
   - Returning ordered `quiz.questions` and `answeredQuestionIds` from `/api/admin/exams/[quizId]/proctor` enables rendering visual dot indicators (Green = answered, Slate = pending) alongside realtime score points for every participant (both `IN_PROGRESS` and `SUBMITTED`).
4. **Violation Strike Indicators (Step 4)**:
   - Styling strikes as Green (0/3), Yellow/Amber (1-2/3), and Red (3/3) provides immediate visual awareness to the supervisor.
5. **Supervisor Actions with Custom Dialogs (Step 5)**:
   - Wiring row action buttons (Unlock, Force Submit, Kick/Disqualify) through `useDialog().confirm(...)` ensures safety, zero native dialog usage, and instant execution via `/api/admin/exams/[quizId]/action`.
6. **Mobile Responsiveness (Step 6)**:
   - Using `overflow-x-auto`, `flex-col sm:flex-row`, and responsive grid cards guarantees seamless operation on smartphone screens (< 640px) as well as desktop monitors.

---

## 3. Caveats

- **Network Jitter**: When high latency occurs, 3-second polling could occasionally take longer than 3 seconds. Using an `isFetching` ref prevents request stacking.
- **Admin Preview Mode**: In preview mode, attempts may not exist or may be simulated; the UI must gracefully handle empty lists and display empty state placeholders.

---

## 4. Conclusion

The existing codebase already contains the foundational models, action API routes, and dialog infrastructure. The implementation requires:
1. Enhancing `/api/admin/exams/[quizId]/proctor/route.ts` to return ordered questions and `answeredQuestionIds`.
2. Upgrading `src/app/admin/exams/[quizId]/proctor/page.tsx` with:
   - 3-second polling loop.
   - Top 3 Gamified Podium (Gold, Silver, Bronze) with dynamic rank shift indicators (`↑`, `↓`, `=`).
   - Live Participant List with % progress bar, per-question visual dot matrix, realtime score, live connection status, and colored strike badges (Yellow 1-2, Red 3).
   - Quick proctor actions (Unlock, Force Submit, Disqualify) with custom `useDialog` confirmations.
   - Class filter dropdown and sorting options (Highest Score, Fastest Progress, Most Strikes, Name A-Z).
   - 100% mobile responsive layout.
3. Ensuring `src/app/student/quiz/[quizId]/page.tsx` sends background progress updates to `/api/quiz/[quizId]/progress`.

---

## 5. Verification Method

1. **Type-Check & Build**:
   ```powershell
   npm run build
   ```
2. **API Verification**:
   - `GET /api/admin/exams/[quizId]/proctor`: verify response returns `quiz.questions`, `attempts` with `answeredQuestionIds`, `progressPercentage`, `score`, and `strikeCount`.
   - `POST /api/admin/exams/[quizId]/action`: verify `UNLOCK`, `FORCE_SUBMIT`, `DISQUALIFY` update `QuizAttempt` and create `ExamViolationLog`.
3. **UI Verification**:
   - Open `/admin/exams/[quizId]/proctor` in browser.
   - Verify Top 3 podium renders with 2-1-3 layout and dynamic rank badges.
   - Verify participant list shows per-question dots, live scores, and colored strikes.
   - Verify action buttons trigger custom modal dialogs (no browser `alert`/`confirm`).
   - Test responsive layout at viewport `< 640px`.
