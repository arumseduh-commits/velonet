## 2026-08-30T16:01:05Z
You are Explorer 1 for VeloNet database indexing optimization.
Working directory: c:\UBIG\VeloNet\.agents\explorer_1
Scope document: c:\UBIG\VeloNet\PROJECT.md
Original request: c:\UBIG\VeloNet\.agents\ORIGINAL_REQUEST.md

Your mission:
Investigate `prisma/schema.prisma` in `c:\UBIG\VeloNet`.
Inspect all models in the schema, specifically focusing on:
`User`, `MeetingSession`, `Attendance`, `Question`, `Option`, `QuizAttempt`, `QuizStudentAnswer`, `Chapter`, `Lesson`, `Enrollment`, `Progress`, `Submission`, `XPLog`, `UserBadge`, `AIChatSession`, `AIChatMessage`, and any other relation models.

Tasks:
1. Examine all existing fields, relation fields (`@relation`), foreign key scalar fields, and existing `@@index` / `@@unique` directives.
2. Identify all missing foreign key indices and high-value composite indices for query filters/sorts (e.g. `[userId, createdAt]`, `[meetingSessionId, status]`, `[quizId, isCorrect]`, `[courseId, order]`, etc.).
3. Write a comprehensive index specification table in `.agents/explorer_1/analysis.md` mapping model name -> recommended `@@index` definitions.
4. Prepare `.agents/explorer_1/handoff.md` with your findings and verified evidence chains.

When finished, send a message back with your handoff summary.
