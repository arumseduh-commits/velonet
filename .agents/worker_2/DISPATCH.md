## 2026-08-30T16:04:21Z

You are Worker 2 for VeloNet Milestone M2: Biometric Data Payload Diet & Elimination of Blocking I/O.
Working directory: c:\UBIG\VeloNet\.agents\worker_2
Scope document: c:\UBIG\VeloNet\PROJECT.md
Original request: c:\UBIG\VeloNet\.agents\ORIGINAL_REQUEST.md
Explorer report: c:\UBIG\VeloNet\.agents\explorer_2\analysis.md and c:\UBIG\VeloNet\.agents\explorer_2\handoff.md

Your exclusive write ownership:
- `src/app/api/attendance/face-descriptors/route.ts`
- `src/app/api/participants/route.ts`
- `src/app/api/student/auth/me/route.ts`
- `src/app/api/student/profile/route.ts`
- `src/app/api/admin/face/register/route.ts`
- `src/app/api/student/face/register/route.ts`
- `src/app/api/student/auth/login-face/route.ts`

Mission:
Implement payload diet and non-blocking I/O refactoring as detailed in `.agents/explorer_2/analysis.md`.

Specific instructions:
1. In `src/app/api/attendance/face-descriptors/route.ts`:
   - Remove `facePhoto: true` from the `select` projection.
   - Omit `facePhoto` from the returned JSON objects. Keep `id`, `name`, `studentClass`, `phoneNumber`, `gender`, and `descriptor`.
2. In `src/app/api/participants/route.ts`:
   - Add explicit `select` projection in `prisma.user.findMany` containing only UI fields (`id`, `phoneNumber`, `name`, `studentClass`, `motivation`, `hobby`, `gender`, `birthDate`, `status`, `isExcluded`, `isKickedFromGrp`, `lastSentAt`, `faceDescriptor`, `createdAt`, `updatedAt`), completely excluding `facePhoto` and sensitive tokens.
   - Remove the blocking `Promise.all` LID heal loop and database update/delete calls (`botEngine.resolveLidToRealPhone`) from the GET request handler. Return the participants directly.
3. In `src/app/api/student/auth/me/route.ts` & `src/app/api/student/profile/route.ts`:
   - Remove dynamic import of `botEngine`, remove blocking `resolveLidToRealPhone` calls, and remove database mutation updates from the HTTP GET handlers.
4. In `src/app/api/admin/face/register/route.ts`, `src/app/api/student/face/register/route.ts`, and `src/app/api/student/auth/login-face/route.ts`:
   - Remove `facePhoto: true` from candidate select queries when evaluating `findBestFaceMatch`.
5. Run TypeScript check or test verification:
   - Verify code compiles cleanly without errors.
6. Document changes and test results in `.agents/worker_2/changes.md` and `.agents/worker_2/handoff.md`.
