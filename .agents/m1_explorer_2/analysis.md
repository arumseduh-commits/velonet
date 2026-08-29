# Milestone 1: Student Exam Hub Analysis & Implementation Plan

**Target Files**:
- `src/app/api/student/exams/route.ts` (API route)
- `src/app/student/exams/page.tsx` (Student Exam Hub page)

---

## 1. Executive Summary
The Student Exam Hub (`/student/exams`) is the primary student portal for discovering and starting CBT exams. Under Milestone 1 (Window of Availability Scheduling), the portal must clearly communicate exam scheduling states (`UPCOMING`, `OPEN`, `CLOSED`), provide live countdowns or clear scheduling metadata, enforce button gating (disabled for upcoming/closed exams, active for open/in-progress exams), provide clean tabbed filtering, and maintain 100% mobile responsiveness (<640px) without native dialogs.

---

## 2. Detailed File Inspection & Findings

### A. API Route: `src/app/api/student/exams/route.ts`
1. **Authentication & Session**:
   - Line 9: Authenticates student via `getLoggedInStudent()`. Returns 401 if unauthorized.
2. **Database Query**:
   - Lines 14–39: Queries all `prisma.quiz.findMany` ordered by `createdAt: "desc"`.
   - Includes `questions` (`id`, `points`) and student's latest `attempts` (`where: { userId: student.id }`).
3. **Availability Calculation Logic**:
   - Lines 45–57:
     ```typescript
     const now = new Date();
     const isUpcoming = Boolean(q.openAt && now < new Date(q.openAt));
     const isPastClose = Boolean(q.closeAt && now > new Date(q.closeAt));
     const hasStarted = Boolean(latestAttempt && latestAttempt.startedAt);

     let availability: "UPCOMING" | "OPEN" | "CLOSED" = "OPEN";
     if (isUpcoming) {
       availability = "UPCOMING";
     } else if (isPastClose && !hasStarted) {
       availability = "CLOSED";
     } else {
       availability = "OPEN";
     }
     ```
   - **Assessment**:
     - Correctly categorizes `UPCOMING` when `now < q.openAt`.
     - Correctly categorizes `CLOSED` when `now > q.closeAt` AND student has not started.
     - If student started before `closeAt` (`hasStarted === true`), `availability` stays `"OPEN"`, allowing student to resume and complete their remaining personal timer duration.
     - If both `openAt` and `closeAt` are null, defaults to `"OPEN"`.
4. **Returned Fields**:
   - Returns `openAt` (ISO string or null), `closeAt` (ISO string or null), and `availability` (`"UPCOMING" | "OPEN" | "CLOSED"`).
   - Sanitizes score visibility (`isScoreVisible`, `isDiscussionVisible`).
   - `attempt` includes `id`, `status`, `score`, `totalScore`, `isFullyGraded`, `strikeCount`, `startedAt`, `submittedAt`.

---

### B. Client Page: `src/app/student/exams/page.tsx`
1. **Critical Syntax Error (Lines 436–438)**:
   - Lines 434–439 contain **3 stray `</div>` tags** that cause a JSX parsing error:
     ```tsx
     434:                 </div>
     435:               </div>
     436:                   </div>
     437:                 </div>
     438:               </div>
     439:             );
     ```
   - Lines 436, 437, and 438 must be removed.

2. **Tab Categorization & Filter Inconsistency**:
   - In lines 99–106:
     ```tsx
     const isDone =
       exam.attempt?.status === "SUBMITTED" ||
       exam.attempt?.status === "GRADED" ||
       exam.attempt?.status === "DISQUALIFIED";

     if (activeTab === "ACTIVE") return !isDone;
     if (activeTab === "COMPLETED") return isDone;
     return true;
     ```
   - In lines 109–115:
     ```tsx
     const activeCount = exams.filter(
       (e) => !e.attempt || e.attempt.status === "IN_PROGRESS" || e.attempt.status === "LOCKED"
     ).length;

     const completedCount = exams.filter(
       (e) => e.attempt?.status === "SUBMITTED" || e.attempt?.status === "GRADED"
     ).length;
     ```
   - **Issues Identified**:
     - `completedCount` omits `DISQUALIFIED` attempts (unlike line 102).
     - When an exam is `CLOSED` and never attempted (`!e.attempt`), it currently falls into `ACTIVE` tab ("Tersedia / Aktif") because `!isDone` is true, which confuses students seeing closed exams under "Tersedia".
     - **Recommended Solution**:
       - `isDone = e.attempt?.status === "SUBMITTED" || e.attempt?.status === "GRADED" || e.attempt?.status === "DISQUALIFIED"`
       - `isExpired = e.availability === "CLOSED" && !e.attempt`
       - Under Tab "Tersedia / Aktif" (`ACTIVE`): show `!isDone && !isExpired` (exams that are `OPEN` or `UPCOMING` or in-progress).
       - Under Tab "Riwayat / Selesai" (`COMPLETED`): show `isDone || isExpired` (exams completed or closed).
       - Under Tab "Semua" (`ALL`): show all exams.
       - Tab counts:
         - `allCount`: `exams.length`
         - `activeCount`: `exams.filter(e => (!e.attempt || e.attempt.status === "IN_PROGRESS" || e.attempt.status === "LOCKED") && e.availability !== "CLOSED").length`
         - `completedCount`: `exams.filter(e => isDone || isExpired).length`

3. **Status Badges & Countdown Timers**:
   - Status Badge States:
     | State | Badge Color | Icon | Label | Action Button |
     |---|---|---|---|---|
     | `DISQUALIFIED` | `bg-rose-50 text-rose-700 border-rose-200` | AlertTriangle | Didiskualifikasi (Nilai 0) | Link to result (Rose outline) |
     | `SUBMITTED` / `GRADED` | `bg-emerald-50 text-emerald-700 border-emerald-200` | CheckCircle2 | Selesai Dikerjakan | Link "Lihat Hasil Ujian" + "Peringkat" button |
     | `LOCKED` | `bg-rose-50 text-rose-700 border-rose-200` | Lock | Terkunci Pelanggaran | Link "Buka Kunci" (Rose pulse) |
     | `IN_PROGRESS` | `bg-amber-50 text-amber-700 border-amber-200` | Ping Dot + Clock | Sedang Dikerjakan | Link "Lanjutkan Ujian" (Amber) |
     | `UPCOMING` | `bg-amber-50 text-amber-800 border-amber-200` | Calendar | Ujian Belum Dibuka | Disabled button "Belum Dibuka" |
     | `CLOSED` | `bg-slate-100 text-slate-500 border-slate-200` | Clock | Ujian Telah Ditutup | Disabled button "Ujian Ditutup" |
     | `OPEN` (Not Started) | `bg-blue-50 text-blue-700 border-blue-200` | Sparkles / Clock | Tersedia / Berlangsung | Link "Ikuti Ujian" (Blue-Indigo gradient) |

   - Live Schedule Pill & Countdown:
     - For `UPCOMING` exams:
       - Displays formatted Indonesian datetime: `Buka: DD MMM YYYY, HH:mm WIB`
       - If within 24 hours: Realtime ticking countdown `⏱️ Dibuka dlm: Xj Ym Zs`
     - For `OPEN` exams with `closeAt`:
       - Displays `Tutup: DD MMM YYYY, HH:mm WIB`
       - If closing within 2 hours: Amber warning pill `⏱️ Sisa waktu buka: Xj Ym`
     - For `CLOSED` exams:
       - Displays `Ditutup pada: DD MMM YYYY, HH:mm WIB`

4. **Mobile Responsiveness Standard (< 640px)**:
   - Header banner: Uses responsive padding (`p-5 sm:p-8`), responsive text sizes (`text-xl sm:text-3xl`).
   - Tabs: Uses flex wrap / scrollable row (`flex-wrap sm:flex-nowrap gap-1.5 p-1 bg-slate-100 rounded-2xl`).
   - Search input: Uses full width on mobile (`w-full sm:max-w-xs`).
   - Card layout: `grid grid-cols-1 md:grid-cols-2 gap-4`.
   - Card action footer: `flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3`. Action buttons have comfortable touch targets (>= 40px) and wrap cleanly on small screens.
   - Strictly uses `useDialog` from `@/components/ui/DialogProvider` (no `window.alert` or `window.confirm`).

---

## 3. Proposed Code Specifications

### A. Helper Function: `useCurrentTime` & `formatCountdown`
Add a lightweight client-side live ticking hook or interval:
```typescript
function formatTimeRemaining(targetDateStr: string): string {
  const diff = new Date(targetDateStr).getTime() - Date.now();
  if (diff <= 0) return "00:00:00";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}h ${remHours}j`;
  }
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
```

### B. Complete Proposed Replacement for `src/app/student/exams/page.tsx`
(See section 4 for exact proposed code).

---

## 4. Verification Plan
1. **Type Check**: Run `npx tsc --noEmit` to verify 0 TypeScript errors.
2. **Build Check**: Run `npm run build` to verify clean App Router compilation.
3. **Functional Verification**:
   - `UPCOMING` exam: displays "Ujian Belum Dibuka", countdown/schedule info, disabled "Belum Dibuka" button.
   - `OPEN` exam: displays "Tersedia / Berlangsung", active "Ikuti Ujian" button.
   - `CLOSED` exam: displays "Ujian Telah Ditutup", disabled "Ujian Ditutup" button.
   - In-progress exam: displays "Sedang Dikerjakan", active "Lanjutkan Ujian" button.
   - Completed exam: displays score and "Lihat Hasil Ujian" + "Peringkat" button.
   - Tabs "Semua", "Tersedia / Aktif", "Riwayat" accurately filter exams without leaking closed exams into available list.
   - Viewport <640px test: No horizontal scrolling, touch targets >= 40px, proper stacking.
