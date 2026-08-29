# Handoff Report: Student Exam Pages, Quiz Runner, Window Enforcement & Interim Progress Sync

**Agent**: `survey_explorer_2`  
**Working Directory**: `c:\UBIG\VeloNet\.agents\survey_explorer_2`  
**Target Date**: 2026-08-30  
**Handoff Type**: Hard (Task complete)

---

## 1. Observation

1. **Window Fields in Database & APIs**:
   - `prisma/schema.prisma` lines 304–305: `Quiz` model already possesses `openAt DateTime?` and `closeAt DateTime?`.
   - `src/app/api/student/exams/route.ts` lines 46–70: Computes `isUpcoming`, `isPastClose`, and `availability` (`UPCOMING`, `OPEN`, `CLOSED`), and returns them in the payload.
   - `src/app/student/exams/page.tsx` lines 28–56: `ExamItem` TypeScript interface lacks `openAt`, `closeAt`, and `availability`. The UI currently displays all exams without time restrictions or countdowns.
2. **Quiz Runner Availability & Access Gatekeeping**:
   - `src/app/api/quiz/[quizId]/route.ts` lines 20–40: Returns full quiz questions to students regardless of whether `now < openAt` or `now > closeAt`.
   - `src/app/api/quiz/[quizId]/start/route.ts` lines 55–93: Contains `openAt` and `closeAt` checks, but contains a token key mismatch on line 97 (`body.token` vs client sending `{ examToken: token }` in `src/app/student/quiz/[quizId]/page.tsx:271`).
   - `src/app/student/quiz/[quizId]/page.tsx` lines 155–156: Timer initializes `timeLeftSeconds` from `(qData.durationMinutes || 30) * 60`, resetting student timer to full duration upon reload instead of using `att.remainingDurationSecs`.
3. **Interim Progress Sync**:
   - `src/app/api/quiz/[quizId]/progress/route.ts` lines 1–211: Fully built API accepting `questionId`, `optionId`, `selectedOptionIds`, `textResponse`, and `answersMap`, upserting `QuizStudentAnswer` and recalculating `QuizAttempt.score`.
   - `src/app/student/quiz/[quizId]/page.tsx`: **Never calls `/api/quiz/[quizId]/progress`**. Student answers are kept only in React state and `localStorage` until final submit at `/api/quiz/submit`.
   - `src/app/api/admin/exams/[quizId]/proctor/route.ts` lines 31–95: Live proctor dashboard queries `QuizStudentAnswer` and `QuizAttempt.score`, but receives 0 progress until student submits.

---

## 2. Logic Chain

1. **Availability Gatekeeping**:
   - Because `openAt` and `closeAt` define the global testing window, `/student/exams` must show an "Ujian Belum Dibuka" status with a live countdown if `now < openAt`, or "Ujian Telah Ditutup" if `now > closeAt && !attempt?.startedAt`.
   - If a student directly navigates to `/student/quiz/[quizId]`, the runner must present a waiting screen with live countdown timer when `now < openAt`, and a closed screen when `now > closeAt` (unstarted).
   - If a student started before `closeAt` (`startedAt <= closeAt`), their personal countdown timer must continue running ($T = \text{durationMinutes} \times 60 - \text{elapsed}$), allowing them to submit even after `closeAt`.
2. **Interim Progress Synchronization**:
   - To provide the Quizizz-style realtime leaderboard on `/admin/exams/[quizId]/proctor` and protect students from data loss, the runner must dispatch background POST calls to `/api/quiz/[quizId]/progress` whenever answers are selected or typed.
   - For UI responsiveness, selections update local state immediately (optimistic UI), while a non-blocking debounced sync (immediate for MCQ/TF, 800–1000ms for text) runs in the background.
3. **Bug Remediation**:
   - Resuming in-progress attempts must restore `setTimeLeftSeconds(att.remainingDurationSecs)`.
   - Token validation in `start/route.ts` must parse `body.token || body.examToken`.

---

## 3. Caveats

1. **Offline Scenarios**: If student network drops temporarily during an exam, `localStorage` draft ensures answers remain intact on the device. When connectivity restores, the next answer action or submit will synchronize all stored answers via `answersMap`.
2. **Camera Proctoring**: `enableCameraProctor` must remain `@default(false)` per project rules to prevent performance bottlenecks and false face detections on mobile smartphones.
3. **Grace Period for Submit**: Server submission should tolerate small clock drift or network transmission latency (~30-60s) beyond the nominal duration timer.

---

## 4. Conclusion

The CBT student exam system architecture is solid, but requires the following targeted enhancements to satisfy R1 and R3:
1. **Student Exam Hub (`/student/exams`)**: Add `openAt`/`closeAt` visual date range badges, live upcoming countdowns, and disabled states for closed/upcoming exams.
2. **Student Quiz Runner (`/student/quiz/[quizId]`)**:
   - Implement "Ujian Belum Dibuka" screen with dynamic ticking countdown timer to `openAt`.
   - Implement "Ujian Telah Ditutup" screen for expired exams.
   - Fix timer resume bug using `att.remainingDurationSecs`.
   - Implement background debounced progress sync to `/api/quiz/[quizId]/progress` on every answer change with a top-bar cloud sync indicator.
3. **API Alignment**:
   - Fix token parameter reading (`body.token || body.examToken`) in `/api/quiz/[quizId]/start`.
   - Gatekeep `/api/quiz/[quizId]` to prevent question leaks before `openAt`.

---

## 5. Verification Method

1. **Verify Window Restrictions**:
   - Set a quiz `openAt` to 10 minutes in the future. Visit `/student/exams` $\rightarrow$ verify badge "Ujian Belum Dibuka" and countdown timer are visible. Visit `/student/quiz/[quizId]` $\rightarrow$ verify waiting screen with countdown.
   - Set a quiz `closeAt` in the past (with no started attempt) $\rightarrow$ verify status "Ujian Telah Ditutup / Berakhir" and blocked start button.
   - Start an exam before `closeAt`, simulate clock moving past `closeAt` $\rightarrow$ verify student can continue working until personal timer hits 0.
2. **Verify Progress Sync & Proctor Leaderboard**:
   - Open `/student/quiz/[quizId]` in one browser tab and `/admin/exams/[quizId]/proctor` in another.
   - Select answers on the student tab $\rightarrow$ verify progress bar and realtime score update within 3 seconds on the proctor dashboard without clicking submit.
3. **Verify Build & Type Safety**:
   - Run `npm run build` to confirm 0 TypeScript / compilation errors.
