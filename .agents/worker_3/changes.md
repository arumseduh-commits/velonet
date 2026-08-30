# Changes: Milestone 3 (Batching & Transaction Optimization)

**Author**: Worker 3  
**Milestone**: M3 (Batching & Transaction Optimization)  
**Date**: 2026-08-30  
**Target Files**:
- `src/app/api/quiz/submit/route.ts`
- `src/lib/bot-engine.ts`

---

## Summary of Modifications

### 1. `src/app/api/quiz/submit/route.ts`
- **Problem**: CBT Quiz submissions executed an unbatched `for ... await` loop over all graded questions using `prisma.quizStudentAnswer.upsert(...)` outside of a database transaction. This resulted in $N$ sequential round-trips to PostgreSQL (high latency) and lacked atomicity, risking partial writes on network drops or concurrency.
- **Solution**:
  - Wrapped `QuizAttempt` query/creation/update and all `QuizStudentAnswer` upserts inside a single atomic interactive transaction: `prisma.$transaction(async (tx) => { ... }, { timeout: 15000, maxWait: 5000 })`.
  - Executed all student answer upserts concurrently within the transaction using `await Promise.all(gradedDetails.map(detail => tx.quizStudentAnswer.upsert(...)))`.
  - Retained gamification hooks (`awardXP`, `evaluateBadges`) outside the core exam transaction to guarantee that non-critical gamification side effects cannot abort or roll back valid student exam submissions.

### 2. `src/lib/bot-engine.ts` (`fetchGroupMembersWithStatus`)
- **Problem**: When synchronizing WhatsApp group participants, `fetchGroupMembersWithStatus` iterated through `metadata.participants` and executed `await prisma.user.findFirst(...)` sequentially for each participant. In groups with 100–300+ members, this executed 100–300+ round-trip database queries, leading to UI timeouts and bot lag.
- **Solution**:
  - Implemented **Pass 1 (In-Memory)**: Traversed metadata participants, extracted clean numbers and variations (raw digits, normalized `62...`, local `0...`), and populated a `Set<string> candidatePhonesSet`.
  - Executed a **Single Batch Query**: `const existingUsers = await prisma.user.findMany({ where: { phoneNumber: { in: candidatePhones } } })`.
  - Built an **In-Memory Hash Index**: Constructed `Map<string, User> userByPhoneMap` with normalized and prefix variations for $O(1)$ fast lookup.
  - Implemented **Pass 2 (In-Memory)**: Matched each participant to the in-memory map without issuing any per-item database queries.

---

## Verification Results
- **Full Build**: `npm run build` compiled 74 static and dynamic routes with 0 TypeScript/Next.js errors.
- **Test Suite**: `node scripts/test-m3-batching.mjs` executed 13/13 assertions passing with 100% success rate:
  - CBT submission atomic transaction verified.
  - Parallel upserts into `QuizStudentAnswer` verified.
  - Bot group sync Pass 1 Set collection & single batch `findMany` verified.
  - In-memory Map $O(1)$ resolution verified.
- **Regression Suite**: `node scripts/test-m1-scheduling.mjs` passed 46/46 tests (100%).
