# Project: VeloNet Database Indexing, Payload Diet, and CBT/Bot Batch Optimization

## Architecture
VeloNet is a Next.js App Router application backed by PostgreSQL (Prisma ORM) and Tailwind CSS.
- **Database Layer**: `prisma/schema.prisma` managing core entities (`User`, `MeetingSession`, `Attendance`, `Question`, `Option`, `QuizAttempt`, `QuizStudentAnswer`, `Chapter`, `Lesson`, `Enrollment`, `Progress`, `Submission`, `XPLog`, `UserBadge`, `AIChatSession`, `AIChatMessage`, etc.).
- **Attendance & Biometrics**:
  - `/api/participants`: Retrieves participant lists for meetings/classes.
  - `/api/attendance/face-descriptors`: Exposes biometric embeddings for attendance face recognition without transmitting heavy base64 raw photos.
- **CBT Quiz Engine**:
  - `/api/quiz/submit`: Grades and persists full student exam submissions with questions and options.
- **Bot Engine**:
  - `src/lib/bot-engine.ts`: Bot coordination and WhatsApp group member synchronization (`fetchGroupMembersWithStatus`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Comprehensive Database Indexing | Add composite indices (`@@index`) and foreign key indices in `prisma/schema.prisma` for `User`, `MeetingSession`, `Attendance`, `Question`, `Option`, `QuizAttempt`, `QuizStudentAnswer`, `Chapter`, `Lesson`, `Enrollment`, `Progress`, `Submission`, `XPLog`, `UserBadge`, `AIChatSession`, `AIChatMessage`. | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Biometric Payload Diet (/api/participants) | Exclude heavy base64 `facePhoto` from participant list query in `/api/participants`. | M2 | ORIGINAL_REQUEST §R2 |
| 3 | Biometric Payload Diet (/api/attendance/face-descriptors) | Exclude `facePhoto` and only return vector embeddings (`faceDescriptor`) and essential metadata (<50KB total for 30 users). | M2 | ORIGINAL_REQUEST §R2 |
| 4 | Elimination of Blocking LID Resolving | Remove blocking LID resolving from critical GET request paths. | M2 | ORIGINAL_REQUEST §R2 |
| 5 | CBT Quiz Submission Batching & Transaction | Refactor sequential N+1 query loop in `/api/quiz/submit` to single batch query (`findMany` with `in`) and transaction/parallel writes. | M3 | ORIGINAL_REQUEST §R3 |
| 6 | Bot Group Member Sync Batching | Refactor `fetchGroupMembersWithStatus` in `src/lib/bot-engine.ts` from sequential lookups to single batch `findMany` using `in`. | M3 | ORIGINAL_REQUEST §R3 |
| 7 | Next.js Build Verification & GitHub Sync | Pass `npm run build` with 0 errors, verify custom dialogs & mobile responsiveness, git commit and push to origin main. | M4 | ORIGINAL_REQUEST §R4, AGENTS.md |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Comprehensive Database Indexing | Prisma schema indexes (`@@index`), `npx prisma generate` / `db push` validation | none | IN_PROGRESS |
| M2 | Payload Diet & Elimination of Blocking I/O | Optimize `/api/participants` and `/api/attendance/face-descriptors`, eliminate blocking LID resolving | M1 | IN_PROGRESS |
| M3 | Batching & Transaction Optimization | Refactor `/api/quiz/submit` and `src/lib/bot-engine.ts` to batch queries & transactions | M2 | IN_PROGRESS |
| M4 | E2E Testing, Build Check & Git Sync | Full build verification (`npm run build`), review/challenger/auditor verification, git commit & push | M3 | PLANNED |

## Interface Contracts
### Attendance Face Descriptors API
- Endpoint: `GET /api/attendance/face-descriptors?sessionId=...`
- Response: `Array<{ id: string, name: string, studentId?: string, faceDescriptor: string | number[] }>` (NO `facePhoto` raw base64 string)

### Participants List API
- Endpoint: `GET /api/participants`
- Response: List of participants with `id, name, email, role, class, status` without `facePhoto` payload.

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
