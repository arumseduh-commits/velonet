# Handoff Report: Explorer 3 — Proctor Leaderboard & Gamification

**Date:** 2026-08-30  
**From:** Explorer 3 (`.agents/explorer_proctor_leaderboard`)  
**To:** Orchestrator & Implementer Agents  

---

## 1. Observation

1. **Existing Proctor Page & APIs**:
   - `src/app/admin/exams/[quizId]/proctor/page.tsx` exists (470 lines). Currently renders a basic table with search and status tabs, but has no gamified podium, shows `-` for score until submitted, and lacks class filters/sorting options.
   - `src/app/api/admin/exams/[quizId]/proctor/route.ts` exists (98 lines). Currently queries `QuizAttempt` and returns raw attempts without calculated `answeredCount`, `progressPercentage`, or `availableClasses`.
   - `src/app/api/admin/exams/[quizId]/action/route.ts` exists (158 lines). Successfully handles `UNLOCK`, `RESET_STRIKES`, `FORCE_SUBMIT`, and `DISQUALIFY`.
2. **Dialog and Notification System**:
   - `src/components/ui/DialogProvider.tsx` provides `useDialog()` with `confirm({ title, message, variant, icon })` and `toast`. Native browser dialogs (`alert`, `confirm`) are strictly forbidden per `AGENTS.md`.
3. **Student Quiz Taking & Syncing**:
   - `src/app/student/quiz/[quizId]/page.tsx` saves draft to local storage and only submits at the end. R3 will introduce `/api/quiz/[quizId]/progress` to synchronize answers and interim scores to `QuizAttempt.score` and `QuizAttempt.answers` in real time.
4. **Mobile Responsiveness Standard**:
   - `AGENTS.md` mandates that all pages, tables, and dialogs must be 100% responsive on screens `< 640px`.

---

## 2. Logic Chain

1. To fulfill Requirement **R2** (Live Proctor Leaderboard ala Quizizz):
   - The proctor page needs a Top 3 Gamified Podium (Gold #1, Silver #2, Bronze #3) showing dynamic rank positions, crowns/medals, avatars, realtime scores, and answered progress.
   - To show live score updates before final submission, the backend API `GET /api/admin/exams/[quizId]/proctor` must inspect `att.score` and `att.answers` to compute `answeredCount` (e.g. 15), `totalQuestions` (e.g. 20), and `progressPercentage` (e.g. 75%).
2. To create the exciting Quizizz-style rank movement:
   - The frontend stores previous rankings in a React `useRef` and compares `prevRank` with `currentRank` on each 3-second poll tick to show upward green (`↑ +2`) and downward red (`↓ -1`) movement badges.
3. For filter and sorting capabilities:
   - The backend provides `availableClasses` (distinct list of student classes).
   - The frontend provides dynamic sorting for `HIGHEST_SCORE` (Quizizz Leaderboard mode), `FASTEST` (speed/progress), `MOST_VIOLATIONS` (strike surveillance), and `NAME_ASC`.
4. For quick proctor actions:
   - Action buttons (Unlock, Force Submit, Disqualify, Reset Strikes) invoke custom `confirm()` from `useDialog()` with appropriate severity variants (`info`, `warning`, `danger`), maintaining zero native browser popups.
5. For mobile responsiveness:
   - Stat cards use `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`, the podium cards scale gracefully down to 360px viewports, and table rows offer clear touch targets.

---

## 3. Caveats

1. **Realtime Score Dependency (R3)**:
   - The realtime interim score displayed on the proctor dashboard relies on the student's answers being synced via `/api/quiz/[quizId]/progress` (R3). If an attempt has not yet synced answers, `score` defaults to 0 and `answeredCount` to 0.
2. **Essay Scoring**:
   - Essay questions cannot be auto-scored instantly in full without grading; they are accounted for as answered in `progressPercentage`, with pending essay indicators.

---

## 4. Conclusion

The technical requirements for Requirement **R2** are fully mapped out, with clear API payloads, UI component structures, animation logic, and dialog interactions defined in `report.md`. The implementer can proceed with updating `src/app/api/admin/exams/[quizId]/proctor/route.ts` and redesigning `src/app/admin/exams/[quizId]/proctor/page.tsx` with high confidence.

---

## 5. Verification Method

1. **TypeScript Build Verification**:
   ```bash
   npm run build
   ```
   Must succeed with 0 type errors.
2. **Live Proctoring Verification**:
   - Open `/admin/exams/[quizId]/proctor` in browser.
   - Verify Top 3 podium renders with Gold, Silver, and Bronze stylings.
   - Verify polling occurs every 3.0 seconds with live progress counters.
   - Test filters (Class filter dropdown, Status filter tabs, Search input) and Sorting dropdowns.
   - Test supervisor action dialogs (Unlock, Force Submit, Disqualify) using `useDialog`.
   - Test responsive layout on mobile screen simulation (`< 640px`).
