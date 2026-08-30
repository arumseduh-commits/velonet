# Project: VeloNet Database Indexing, Payload Diet, and CBT/Bot Batch Optimization

## Architecture
VeloNet is a Next.js App Router application backed by PostgreSQL (Prisma ORM) and Tailwind CSS.
- **Database Layer**: `prisma/schema.prisma` managing core entities (`User`, `MeetingSession`, `Attendance`, `Question`, `Option`, `QuizAttempt`, `QuizStudentAnswer`, `Chapter`, `Lesson`, `Enrollment`, `Progress`, `Submission`, `XPLog`, `UserBadge`, `AIChatSession`, `AIChatMessage`, etc.) now indexed with 42 composite and foreign key `@@index` definitions.
- **Attendance & Biometrics**:
  - `/api/participants`: Optimized with explicit `select` projection excluding heavy raw base64 `facePhoto` and sensitive tokens. Non-blocking GET.
  - `/api/attendance/face-descriptors`: Exposes biometric vector embeddings (`faceDescriptor`) without transmitting raw images (<32KB for 30 users, 99.58% bandwidth reduction).
- **CBT Quiz Engine**:
  - `/api/quiz/submit`: Grades and persists full student exam submissions inside an atomic `prisma.$transaction` with parallel `Promise.all` upserts.
- **Bot Engine**:
  - `src/lib/bot-engine.ts`: Bot coordination and WhatsApp group member synchronization (`fetchGroupMembersWithStatus`) utilizing a single batch `findMany` query with $O(1)$ in-memory Map resolution.

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Comprehensive Database Indexing | Added 42 composite indices (`@@index`) and foreign key indices in `prisma/schema.prisma` for all 21 relation models. | M1 | ORIGINAL_REQUEST §R1 | DONE |
| 2 | Biometric Payload Diet (/api/participants) | Excluded heavy base64 `facePhoto` from participant list query in `/api/participants`. | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 3 | Biometric Payload Diet (/api/attendance/face-descriptors) | Excluded `facePhoto` and only return vector embeddings (`faceDescriptor`) and essential metadata (31.83 KB total for 30 users). | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 4 | Elimination of Blocking LID Resolving | Removed blocking LID resolving and DB mutations from critical GET request paths (`/api/participants`, `/api/student/auth/me`, `/api/student/profile`). | M2 | ORIGINAL_REQUEST §R2 | DONE |
| 5 | CBT Quiz Submission Batching & Transaction | Refactored sequential N+1 query loop in `/api/quiz/submit` to `prisma.$transaction` with parallel `Promise.all` upserts and isolated gamification evaluation. | M3 | ORIGINAL_REQUEST §R3 | DONE |
| 6 | Bot Group Member Sync Batching | Refactored `fetchGroupMembersWithStatus` in `src/lib/bot-engine.ts` to single batch `findMany` using `in` and in-memory Map lookup. | M3 | ORIGINAL_REQUEST §R3 | DONE |
| 7 | Next.js Build Verification & GitHub Sync | Passed `npm run build` with 0 errors (74/74 routes), verified custom dialogs & mobile responsiveness, git commit and push to origin main (commit `681d356`). | M4 | ORIGINAL_REQUEST §R4, AGENTS.md | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Comprehensive Database Indexing | Prisma schema indexes (`@@index`), `npx prisma generate` / `db push` validation | none | DONE |
| M2 | Payload Diet & Elimination of Blocking I/O | Optimize `/api/participants` and `/api/attendance/face-descriptors`, eliminate blocking LID resolving | M1 | DONE |
| M3 | Batching & Transaction Optimization | Refactor `/api/quiz/submit` and `src/lib/bot-engine.ts` to batch queries & transactions | M2 | DONE |
| M4 | E2E Testing, Build Check & Git Sync | Full build verification (`npm run build`), review/challenger/auditor verification, git commit & push | M3 | DONE |

## Interface Contracts
### Attendance Face Descriptors API
- Endpoint: `GET /api/attendance/face-descriptors?sessionId=...`
- Response: `Array<{ id: string, name: string, studentId?: string, descriptor: number[] }>` (NO `facePhoto` raw base64 string)

### Participants List API
- Endpoint: `GET /api/participants`
- Response: List of participants with `id, phoneNumber, name, studentClass, motivation, hobby, gender, birthDate, status, isExcluded, isKickedFromGrp, lastSentAt, faceDescriptor, createdAt, updatedAt` without `facePhoto` payload.

### CBT Quiz Submission API
- Endpoint: `POST /api/quiz/submit`
- Logic: Evaluate all answers against questions & options, update attempt and insert answers in a single `prisma.$transaction`.

### Bot Group Member Status
- Function: `fetchGroupMembersWithStatus` in `src/lib/bot-engine.ts`
- Logic: Query all members in a single `prisma.user.findMany({ where: { phoneNumber: { in: numbers } } })` rather than loop querying.

## Code Layout
- `prisma/schema.prisma`: Database models & composite indices
- `src/app/api/participants/route.ts`: Participant listing
- `src/app/api/attendance/face-descriptors/route.ts`: Face descriptors biometric endpoint
- `src/app/api/quiz/submit/route.ts`: CBT quiz submission handler
- `src/lib/bot-engine.ts`: Bot synchronization engine
- `src/components/ui/DialogProvider.tsx`: Dialog system
