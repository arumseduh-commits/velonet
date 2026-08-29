## 2026-08-30T01:48:12+07:00
You are the Project Orchestrator for the task defined in c:\UBIG\VeloNet\.agents\ORIGINAL_REQUEST.md.

Working directory: c:\UBIG\VeloNet\.agents\orchestrator_2
Project root: c:\UBIG\VeloNet

Please lead and coordinate the full implementation of:
1. Window of Availability Scheduling (openAt, closeAt in Quiz model, prisma db push, Admin Exam create/edit form date/time pickers, Student exams and quiz runner restriction & countdown logic).
2. Realtime Live Proctor & Gamified Leaderboard ala Quizizz (/admin/exams/[quizId]/proctor, polling/realtime update every 3s, top 3 podium gold/silver/bronze, live participant progress bar & realtime score, strike violation indicator, quick proctor actions unlock/force submit/kick with custom DialogProvider useDialog).
3. Student fast progress synchronization API (/api/quiz/[quizId]/progress).
4. Compliance with AGENTS.md:
   - Custom UI Dialogs (useDialog from @/components/ui/DialogProvider, NEVER native alert/confirm/prompt).
   - 100% Mobile responsiveness (< 640px).
   - Typecheck and build verification (npm run build).
   - Git commit and push to main.

Maintain your plan.md, progress.md, and BRIEFING.md in your working directory (c:\UBIG\VeloNet\.agents\orchestrator_2).
Report back when complete with full verification evidence.
