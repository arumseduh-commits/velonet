## 2026-08-29T18:54:51Z

You are m1_worker for Milestone 1 (Window of Availability Scheduling - Admin & Student UI, Runner Gating & Bugfixes).
Working directory: c:\UBIG\VeloNet\.agents\m1_worker
Project root: c:\UBIG\VeloNet

Read these files first:
1. `c:\UBIG\VeloNet\.agents\ORIGINAL_REQUEST.md`
2. `c:\UBIG\VeloNet\PROJECT.md`
3. `c:\UBIG\VeloNet\.agents\m1_explorer_1\handoff.md` and `analysis.md`
4. `c:\UBIG\VeloNet\.agents\m1_explorer_2\handoff.md` and `analysis.md`
5. `c:\UBIG\VeloNet\.agents\m1_explorer_3\handoff.md` and `analysis.md`

Your tasks:
1. Database: Run `npx prisma db push` to verify database schema sync with `prisma/schema.prisma`.
2. Admin Exam UI:
   - `src/app/admin/exams/create/page.tsx`: Add `openAt` & `closeAt` `<input type="datetime-local">` controls, clear buttons, `openAt < closeAt` validation, payload integration.
   - `src/app/admin/exams/[quizId]/edit/page.tsx`: Add `openAt` & `closeAt` controls with timezone-safe `toLocalDatetimeInputString()` helper, clear buttons, validation, and payload integration.
   - `src/app/admin/exams/page.tsx`: Add visual status badges ("Sedang Berlangsung", "Terjadwal", "Telah Berakhir", "Akses Fleksibel") and schedule date displays.
3. Student Exam Hub:
   - `src/app/student/exams/page.tsx`: Fix stray `</div>` JSX syntax errors, implement live ticking countdown badges for upcoming exams, schedule indicators, status badges, disabled states for unopened/closed exams, and mobile responsiveness (< 640px).
4. Student Quiz Runner & Bug Fixes:
   - `src/app/student/quiz/[quizId]/page.tsx`:
     - Waiting screen with live ticking countdown when `now < openAt` (unstarted) and auto-unlock when timer expires.
     - Expired screen when `now > closeAt` (unstarted).
     - Full personal timer duration tolerance if started before `closeAt`.
     - Timer reset bug fix: when resuming an active attempt, use `attempt.remainingDurationSecs` (or elapsed calculation), never reset back to full duration.
     - Exam token bug fix: pass `examTokenInput` from state and accept both `token` and `examToken`.
   - `src/components/quiz/ExamPreCheckModal.tsx`: ensure `examTokenInput` is passed to `onStartExam`.
   - `src/app/api/quiz/[quizId]/start/route.ts`: accept both `body.token` and `body.examToken`.
5. Compliance:
   - STRICTLY use `useDialog()` from `@/components/ui/DialogProvider` - NO native `alert()`, `confirm()`, `prompt()`.
   - 100% mobile responsiveness (<640px).
6. Verification:
   - Run `npm run build` to verify 0 TypeScript and build errors.
7. Write your changes and verification to `c:\UBIG\VeloNet\.agents\m1_worker\changes.md` and `handoff.md`.
