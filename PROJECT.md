# Project: VeloNet CBT Exam Scheduling & Realtime Live Proctor Leaderboard

## Architecture
VeloNet CBT is a Next.js 14+ App Router application with PostgreSQL, Prisma ORM, and Tailwind CSS.
- **Admin Management**: `/admin/exams/*` manages exam creation, editing, scheduling (`openAt`, `closeAt`), and live supervision (`/admin/exams/[quizId]/proctor`).
- **Student Exam Hub & Runner**: `/student/exams` lists available exams with availability status; `/student/quiz/[quizId]` runs the CBT exam with window-of-availability gating, countdown timer, anti-cheat monitoring, and background interim progress sync.
- **APIs**:
  - `/api/admin/exams/*`: Admin CRUD for exams and proctor actions.
  - `/api/admin/exams/[quizId]/proctor`: Realtime proctor polling endpoint.
  - `/api/admin/exams/[quizId]/action`: Supervisor actions (UNLOCK, FORCE_SUBMIT, DISQUALIFY, RESET_STRIKES).
  - `/api/student/exams`: Lists student exams with calculated availability.
  - `/api/quiz/[quizId]/start`: Starts/resumes quiz attempt with token and availability checks.
  - `/api/quiz/[quizId]/progress`: Non-blocking fast background answer & score synchronization.
  - `/api/quiz/[quizId]/submit`: Final exam submission.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Prisma Schema & DB Push | `openAt DateTime?` and `closeAt DateTime?` on Quiz model, verified via `npx prisma db push` | M1 (DONE) | ORIGINAL_REQUEST §R1.1 |
| 2 | Admin Exam Create & Edit Scheduling Form | Date/time pickers (`type="datetime-local"`) for `openAt` & `closeAt`, chronological validation (`openAt < closeAt`), payload persistence | M1 (DONE) | ORIGINAL_REQUEST §R1.2 |
| 3 | Student Exams Availability Display | Status badges ("Ujian Belum Dibuka", "Sedang Berlangsung", "Ujian Telah Ditutup") with countdown & disabled action buttons | M1 (DONE) | ORIGINAL_REQUEST §R1.3 |
| 4 | Student Quiz Runner Window Restrictions | Dedicated "Ujian Belum Dibuka" waiting screen with live ticking countdown, "Ujian Telah Ditutup" expired screen, personal timer tolerance if started before `closeAt` | M1 (DONE) | ORIGINAL_REQUEST §R1.3 |
| 5 | Quiz Runner Token & Timer Bug Fixes | Fix token payload mismatch (`examToken` vs `token`) and timer reset on page reload (`remainingDurationSecs`) | M1 (DONE) | Survey Finding |
| 6 | Fast Background Progress Sync Hook & API | Connect runner answer changes to `/api/quiz/[quizId]/progress` with optimistic UI and non-blocking background sync | M2 (DONE) | ORIGINAL_REQUEST §R3.1 |
| 7 | Live Proctor Realtime Polling (3s) | High-frequency polling (3s) with concurrency lock, silent background update, and live connection status | M3 (DONE) | ORIGINAL_REQUEST §R2.1 |
| 8 | Gamified Top 3 Podium ala Quizizz | Gold #1, Silver #2, Bronze #3 podium with animated rank transitions, delta badges (`↑`, `↓`, `=`), and score points | M3 (DONE) | ORIGINAL_REQUEST §R2.2 |
| 9 | Live Participant List with Progress Bar & Question Matrix | Progress bar (% answered) + per-question visual dot matrix, realtime score, connection status, strike indicators (Yellow 1-2, Red 3+) | M3 (DONE) | ORIGINAL_REQUEST §R2.3 |
| 10 | Quick Proctor Actions with useDialog | Unlock, Force Submit, Kick/Disqualify, Reset Strikes using custom `useDialog` from `@/components/ui/DialogProvider` | M3 (DONE) | ORIGINAL_REQUEST §R2.4, AGENTS.md |
| 11 | Class Filtering & Sorting Controls | Filter by `studentClass` and sort by Highest Score, Fastest Progress, Most Strikes, Name | M3 (DONE) | ORIGINAL_REQUEST §R2.5 |
| 12 | 100% Mobile Responsiveness (<640px) | Responsive tables (`overflow-x-auto`), flex-col/sm:flex-row headers, responsive modal dialogs, drawer menus | M3 (DONE) | AGENTS.md |
| 13 | E2E Testing Suite (Tiers 1-4) & Build Verification | Requirement-driven test suite, `npm run build` with 0 TypeScript/ESLint errors, Git commit & push | M4 | AGENTS.md, ORIGINAL_REQUEST Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Window of Availability Scheduling | Prisma schema, db push, Admin Create/Edit forms, Student Exams hub, Quiz Runner gating & countdowns, timer bugfixes | none | DONE |
| M2 | Student Fast Progress Sync | Background sync hook in runner, non-blocking `/api/quiz/[quizId]/progress` integration | M1 | DONE |
| M3 | Realtime Live Proctor & Gamified Leaderboard | `/admin/exams/[quizId]/proctor`, 3s polling, Top 3 Podium, live progress matrix, strike badges, supervisor actions with `useDialog`, mobile responsive | M2 | DONE |
| M4 | E2E Testing, Build Check & GitHub Sync | Comprehensive test suite, `npm run build` verification, `git commit` and `git push origin main` | M3 | IN_PROGRESS |

## Interface Contracts
### Admin Exam API ↔ Create/Edit Form
- Payload: `{ openAt?: string | null, closeAt?: string | null, ... }` (ISO 8601 string or null)
- Validation: If both provided, `new Date(openAt) < new Date(closeAt)` must be true.

### Student Quiz Runner ↔ Progress Sync API
- Endpoint: `POST /api/quiz/[quizId]/progress`
- Payload: `{ questionId: string, answer: any }`
- Response: `{ success: true, answeredCount: number, totalQuestions: number, currentScore: number }`

### Proctor Dashboard ↔ Proctor API
- Endpoint: `GET /api/admin/exams/[quizId]/proctor`
- Response includes:
  - `quiz`: id, title, totalQuestions, questions: [{ id, questionNumber }]
  - `participants`: array of `{ id, studentId, studentName, studentClass, status, score, answeredCount, totalQuestions, answeredQuestionIds: string[], strikes, violations: [], lastPing, startedAt, submittedAt }`

## Code Layout
- `prisma/schema.prisma`: Data models
- `src/app/admin/exams/create/page.tsx`: Admin Exam creation form
- `src/app/admin/exams/[quizId]/edit/page.tsx`: Admin Exam edit form
- `src/app/admin/exams/page.tsx`: Admin Exams list
- `src/app/admin/exams/[quizId]/proctor/page.tsx`: Realtime Live Proctor & Leaderboard
- `src/app/api/admin/exams/...`: Admin exam APIs
- `src/app/api/admin/exams/[quizId]/proctor/route.ts`: Proctor polling endpoint
- `src/app/api/admin/exams/[quizId]/action/route.ts`: Supervisor actions endpoint
- `src/app/student/exams/page.tsx`: Student Exam Hub
- `src/app/student/quiz/[quizId]/page.tsx`: Student Quiz Runner
- `src/app/api/quiz/[quizId]/progress/route.ts`: Student progress sync endpoint
- `src/components/ui/DialogProvider.tsx`: Custom Dialog & Toast system (`useDialog`)
