## 2026-08-30T16:04:21Z

You are Worker 3 for VeloNet Milestone M3: Batching & Transaction Optimization.
Working directory: c:\UBIG\VeloNet\.agents\worker_3
Scope document: c:\UBIG\VeloNet\PROJECT.md
Original request: c:\UBIG\VeloNet\.agents\ORIGINAL_REQUEST.md
Explorer report: c:\UBIG\VeloNet\.agents\explorer_3\analysis.md and c:\UBIG\VeloNet\.agents\explorer_3\handoff.md

Your exclusive write ownership:
- `src/app/api/quiz/submit/route.ts`
- `src/lib/bot-engine.ts`

Mission:
Refactor sequential N+1 query loops to batch queries and atomic transactions in CBT quiz submission and bot group member synchronization as detailed in `.agents/explorer_3/analysis.md`.

Specific instructions:
1. In `src/app/api/quiz/submit/route.ts`:
   - Refactor the sequential answer saving loop (lines 231–258) and attempt update.
   - Wrap the attempt mutation and all `QuizStudentAnswer` upserts (or batch create) in a single `prisma.$transaction(async (tx) => { ... }, { timeout: 15000, maxWait: 5000 })`.
   - Use `await Promise.all(gradedDetails.map(detail => tx.quizStudentAnswer.upsert(...)))` inside the transaction.
   - Keep XP/Badge gamification evaluations outside the transaction so gamification calculations don't block or roll back the core exam submission.
2. In `src/lib/bot-engine.ts`:
   - Refactor `fetchGroupMembersWithStatus` (lines 710–780).
   - In Pass 1: Parse WhatsApp metadata participants, collect all phone numbers (raw digits, normalized 62..., 0...) into a `Set<string>`.
   - Query in a single batch: `const dbUsers = await prisma.user.findMany({ where: { phoneNumber: { in: Array.from(candidatePhonesSet) } } });`
   - Build a `Map<string, User>` in memory.
   - In Pass 2: Match each participant against the Map in $O(1)$ time without making individual database queries in the loop.
3. Run verification tests / type checks:
   - Ensure all responses, types, and logic match existing contracts.
4. Document changes and test results in `.agents/worker_3/changes.md` and `.agents/worker_3/handoff.md`.
