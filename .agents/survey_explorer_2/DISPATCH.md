## 2026-08-29T18:49:53Z
You are survey_explorer_2 for the VeloNet project.
Working directory: c:\UBIG\VeloNet\.agents\survey_explorer_2
Read ORIGINAL_REQUEST.md at c:\UBIG\VeloNet\.agents\ORIGINAL_REQUEST.md and explore the codebase.

Your mission:
1. Examine Student Exam pages and Quiz Runner:
   - `/student/exams` (`src/app/student/exams/page.tsx`, related components/APIs)
   - `/student/quiz/[quizId]` (`src/app/student/quiz/[quizId]/page.tsx`, runner components, timer logic, start logic, submit logic)
2. Analyze how window of availability restrictions (`openAt`, `closeAt`) should be enforced:
   - Before `openAt`: access blocked, "Ujian Belum Dibuka" status + countdown timer.
   - After `closeAt` if not started: access blocked, "Ujian Telah Ditutup / Berakhir".
   - If started before `closeAt`: student allowed to complete remaining personal timer duration.
3. Analyze how student answer state and interim progress/score synchronization should work:
   - What happens when a student picks or changes an answer?
   - How to design `/api/quiz/[quizId]/progress` for fast background sync without lagging the UI.
4. Write your complete analysis report to `c:\UBIG\VeloNet\.agents\survey_explorer_2\analysis.md` and `handoff.md`.
5. Send a completion message back with the key findings.
