# Handoff Report: Biometric Data Payload Diet & Elimination of Blocking I/O

**Agent**: Explorer 2  
**Working Directory**: `c:\UBIG\VeloNet\.agents\explorer_2`  
**Milestone**: M2 (Payload Diet & Elimination of Blocking I/O)

---

## 1. Observation

### 1.1 `/api/attendance/face-descriptors/route.ts`
- **Path**: `src/app/api/attendance/face-descriptors/route.ts`
- **Lines 13–21**:
  ```ts
  select: {
    id: true,
    name: true,
    phoneNumber: true,
    studentClass: true,
    gender: true,
    faceDescriptor: true,
    facePhoto: true,
  }
  ```
- **Lines 32–40**:
  ```ts
  return {
    id: u.id,
    name: u.name || "Peserta",
    studentClass: u.studentClass || "-",
    phoneNumber: u.phoneNumber,
    gender: u.gender,
    facePhoto: u.facePhoto,
    descriptor: descriptorArray,
  };
  ```
- **Consumer**: `src/app/admin/face-terminal/page.tsx` line 109 fetches `/api/attendance/face-descriptors`. The matching logic in `src/lib/client-face-api.ts` only consumes `descriptor: number[]`. `facePhoto` is not rendered or used.

### 1.2 `/api/participants/route.ts`
- **Path**: `src/app/api/participants/route.ts`
- **Lines 33–36**:
  ```ts
  const participants = await prisma.user.findMany({
    where: whereClause,
    orderBy: { updatedAt: "desc" },
  });
  ```
- **Lines 38–77**:
  ```ts
  const healedParticipants = await Promise.all(
    participants.map(async (p) => {
      const isLid = p.phoneNumber.length > 14 || (!p.phoneNumber.startsWith("62") && !p.phoneNumber.startsWith("08"));
      if (isLid) {
        try {
          const { botEngine } = await import("@/lib/bot-engine");
          const resolved = await botEngine.resolveLidToRealPhone(p.phoneNumber);
          if (resolved && (resolved.startsWith("62") || resolved.startsWith("08"))) {
            const existingReal = await prisma.user.findUnique({
              where: { phoneNumber: resolved },
            });
            if (existingReal && existingReal.id !== p.id) {
              // Merge
              const merged = await prisma.user.update({
                where: { id: existingReal.id },
                data: {
                  name: p.name || existingReal.name,
                  studentClass: p.studentClass || existingReal.studentClass,
                  motivation: p.motivation || existingReal.motivation,
                  hobby: p.hobby || existingReal.hobby,
                  status: p.status !== "NOT_STARTED" ? p.status : existingReal.status,
                  faceDescriptor: p.faceDescriptor || existingReal.faceDescriptor,
                  facePhoto: p.facePhoto || existingReal.facePhoto,
                },
              });
              await prisma.user.delete({ where: { id: p.id } }).catch(() => {});
              return merged;
            } else {
              return await prisma.user.update({
                where: { id: p.id },
                data: { phoneNumber: resolved },
              });
            }
          }
        } catch (e) {}
      }
      return p;
    })
  );
  ```

### 1.3 Blocking LID Lookups in Student GET Endpoints
- **Path**: `src/app/api/student/auth/me/route.ts` (lines 35–48)
- **Path**: `src/app/api/student/profile/route.ts` (lines 17–30)
  Both routes perform dynamic import of `botEngine`, invoke `resolveLidToRealPhone(currentPhone)`, and execute `prisma.user.update` during HTTP `GET` requests.

### 1.4 Biometric Registration/Login Unnecessary `facePhoto` Queries
- **Path**: `src/app/api/admin/face/register/route.ts` (line 40)
- **Path**: `src/app/api/student/face/register/route.ts` (line 43)
- **Path**: `src/app/api/student/auth/login-face/route.ts` (line 33)
  All 3 endpoints select `facePhoto: true` into memory when querying candidates for `findBestFaceMatch`, even though `findBestFaceMatch` only uses `faceDescriptor`.

---

## 2. Logic Chain

1. **Observation 1.1** shows `GET /api/attendance/face-descriptors` includes `facePhoto: u.facePhoto` (large base64 string). The client face terminal strictly needs the numerical vector `descriptor` for Euclidean distance calculations. Transmitting base64 images balloons response size from <30KB to ~30MB.
2. **Observation 1.2** shows `GET /api/participants` lacks a `select` projection, returning `facePhoto` and sensitive user fields. The UI consumer `src/app/admin/participants/page.tsx` only renders tabular metadata and descriptor presence badge (`p.faceDescriptor ? ... : ...`).
3. Furthermore, **Observation 1.2 and 1.3** show `GET /api/participants`, `GET /api/student/auth/me`, and `GET /api/student/profile` execute `botEngine.resolveLidToRealPhone()` and mutate the database (`prisma.user.update`, `prisma.user.delete`). This introduces severe network/IO blocking and violates HTTP GET idempotency.
4. **Observation 1.4** demonstrates that backend face matching logic in registration and authentication routes needlessly selects and retains raw `facePhoto` base64 strings in Node.js heap memory during array iteration.

---

## 3. Caveats

- **Single Participant Detail View**: `GET /api/participants/[slug]` legitimately serves `facePhoto` for rendering the individual profile photo on `/admin/participants/[slug]`. This is for a single record and does not cause unbounded collection payload inflation.
- **LID Healing Lifecycle**: LID numbers are already resolved and merged asynchronously upon incoming WhatsApp messages in `src/lib/bot-state-machine.ts` (lines 130–165). Removing the blocking LID heal from GET routes does not break bot message handling.

---

## 4. Conclusion

To achieve Milestone M2:
1. **Pangkas Payload Biometrik di `/api/attendance/face-descriptors`**:
   - Exclude `facePhoto: true` from the `select` projection.
   - Omit `facePhoto` from the returned JSON array.
   - Result: Response payload <50KB for 30 users.
2. **Pangkas Payload Peserta di `/api/participants`**:
   - Add explicit `select` clause in `prisma.user.findMany` containing only UI fields (`id`, `phoneNumber`, `name`, `studentClass`, `motivation`, `hobby`, `gender`, `birthDate`, `status`, `isExcluded`, `isKickedFromGrp`, `lastSentAt`, `faceDescriptor`, `createdAt`, `updatedAt`).
   - Remove blocking `botEngine.resolveLidToRealPhone` loop and DB writes from `GET /api/participants`.
3. **Eliminasi Blocking LID di Critical GET Paths**:
   - Remove `botEngine.resolveLidToRealPhone` and DB writes from `src/app/api/student/auth/me/route.ts` and `src/app/api/student/profile/route.ts`.
4. **Optimasi Memory Projections Tambahan**:
   - Remove `facePhoto: true` from candidate queries in `src/app/api/admin/face/register/route.ts`, `src/app/api/student/face/register/route.ts`, and `src/app/api/student/auth/login-face/route.ts`.
   - Add field projections to export and reporting routes (`src/app/api/participants/export/route.ts`, `src/app/api/exclusions/route.ts`, `src/app/api/kick-list/route.ts`, `src/app/api/reports/cumulative/route.ts`, `src/app/api/sessions/[id]/route.ts`).

---

## 5. Verification Method

- **Code Review**:
  - `view_file` on `src/app/api/attendance/face-descriptors/route.ts` to confirm absence of `facePhoto` in `select` and JSON return.
  - `view_file` on `src/app/api/participants/route.ts` to confirm explicit `select` projection and removal of `Promise.all` LID heal.
  - `view_file` on `src/app/api/student/auth/me/route.ts` and `src/app/api/student/profile/route.ts` to confirm clean GET handlers.
- **Build & Type Check**:
  - Run `npm run build` or `npx tsc --noEmit` to verify type compliance across all modified route handlers and consumers.
