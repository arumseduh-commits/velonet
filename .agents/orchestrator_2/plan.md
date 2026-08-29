# Project Plan: CBT Exam Scheduling & Realtime Live Proctor Leaderboard

## Objective
Implement Window of Availability Scheduling, Realtime Live Proctor Leaderboard ala Quizizz, and Student fast progress sync API with 100% mobile responsiveness, custom DialogProvider dialogs, TypeScript build passing, and GitHub sync.

## Phases
- Phase 0: Survey & Scope Mapping (3 Explorers) -> Create PROJECT.md
- Phase 1 (M1): Window of Availability Scheduling
  - Prisma schema update: `openAt`, `closeAt` on Quiz model
  - DB push via `npx prisma db push`
  - Admin exam create/edit forms with date-time pickers and API routes
  - Student exams listing & quiz runner restriction + countdown timers
- Phase 2 (M2): Fast Progress Synchronization API
  - `/api/quiz/[quizId]/progress` endpoint
  - Realtime/background answer change and interim score sync in CBT runner
- Phase 3 (M3): Realtime Live Proctor & Gamified Leaderboard
  - `/admin/exams/[quizId]/proctor` page with dynamic polling (3s)
  - Podium Top 3 Gamification (Gold, Silver, Bronze) with animated dynamic rank shifts ala Quizizz
  - Live Participants List with progress bar, realtime score, strike violation indicator
  - Quick proctor actions (Unlock, Force Submit, Kick) with `useDialog`
  - Filter by class and sort (Highest Score, Fastest, Most Strikes)
- Phase 4 (M4): Testing Track & Final Verification
  - E2E test verification & integration testing
  - Full TypeScript build check (`npm run build`)
  - Git commit & push to main
