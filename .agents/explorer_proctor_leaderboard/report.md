# Live Proctor Leaderboard & Gamification Architecture Report (Explorer 3)

**Author:** Explorer 3 (Teamwork Explorer)  
**Date:** 2026-08-30  
**Target:** Realtime Live Proctor & Gamified Leaderboard ala Quizizz (`/admin/exams/[quizId]/proctor`)  
**Workspace:** `c:\UBIG\VeloNet`  

---

## Executive Summary

The VeloNet CBT system already possesses the foundation of an exam proctoring room at `/admin/exams/[quizId]/proctor` and supporting APIs at `/api/admin/exams/[quizId]/proctor` and `/api/admin/exams/[quizId]/action`. However, it currently functions only as a static inspection table where score is hidden until submission, lacking the **Quizizz-style live gamified Top 3 podium**, **real-time score & question progress sync**, **rank movement animations (up/down rank shifts)**, **class filtering**, **multidimensional sorting**, and **optimized mobile responsive layouts**.

This report provides a comprehensive, actionable technical blueprint for enhancing the Proctor page and its backing APIs to fulfill Requirements **R2** and support **R3** of `ORIGINAL_REQUEST.md`, fully adhering to the UI/UX, dialog (`useDialog`), and mobile responsiveness rules in `AGENTS.md`.

---

## 1. Existing Codebase Audit & Gap Analysis

### 1.1 Existing Files Reviewed
1. **Frontend Proctor Page**: `src/app/admin/exams/[quizId]/proctor/page.tsx` (470 lines)
2. **Backend Proctor API**: `src/app/api/admin/exams/[quizId]/proctor/route.ts` (98 lines)
3. **Backend Action API**: `src/app/api/admin/exams/[quizId]/action/route.ts` (158 lines)
4. **Student Quiz Taking Page**: `src/app/student/quiz/[quizId]/page.tsx` (1367 lines)
5. **Exam Leaderboard Modal**: `src/components/exam/ExamLeaderboardModal.tsx` (264 lines)
6. **Dialog & Toast System**: `src/components/ui/DialogProvider.tsx` (315 lines)
7. **Prisma Schema**: `prisma/schema.prisma` (`Quiz`, `QuizAttempt`, `QuizStudentAnswer`, `ExamViolationLog`)

### 1.2 Comparison Matrix: Current vs Required

| Feature | Current State | Required State (R2 / AGENTS.md) | Gap Severity |
| :--- | :--- | :--- | :--- |
| **Top 3 Podium** | Non-existent | Gold (1st), Silver (2nd), Bronze (3rd) dynamic elevated podium cards with crowns/medals & live points | **HIGH** |
| **Live Score Updates** | Shows `-` until `status === "SUBMITTED"` | Live score point calculations updated in real time as students answer | **HIGH** |
| **Question Progress** | None (only status pill) | Progress bar (e.g. 15/20 Soal • 75%) with color status | **MEDIUM** |
| **Rank Shift Indicator** | None | Real-time rank shifts (`↑ +2`, `↓ -1`, `-`) tracking previous tick rank | **MEDIUM** |
| **Strike Indicators** | Basic mono badge | Color-coded strikes (Green 0, Yellow 1-2, Red 3/3 locked pulsating) | **LOW** |
| **Filters & Sorting** | Status tabs & Search query only | Class dropdown filter, Sort by Highest Score, Fastest, Most Violations, Name | **HIGH** |
| **Polling Interval** | 3500ms | 3000ms (3.0 seconds) with smooth state reconciliation | **LOW** |
| **Proctor Actions** | Basic unlock/force-submit/disqualify | Enhanced confirmation dialogs using `useDialog` + reasons | **LOW** |
| **Mobile Responsiveness** | Standard table with scroll | 100% responsive on `< 640px` with responsive cards / compact podium | **MEDIUM** |

---

## 2. Realtime 3-Second Polling & Data Architecture

### 2.1 Polling Mechanism Design
- **Interval**: 3,000 ms (3.0 seconds).
- **Execution Hook**: `useEffect` with `setInterval` calling `fetchProctorData(false)`.
- **State Handling**:
  - Store previous attempts in a `useRef` to compute rank differences (`prevRankMap: Map<string, number>`).
  - Update state cleanly without full re-render flickering (preserve search/filter inputs and scroll position).
  - Manual Refresh button triggers `fetchProctorData(true)` which displays a spinning indicator and toast on error.
  - Automatic background polling fails silently on transient network blips to avoid intrusive error toasts.

### 2.2 Backend Payload: `GET /api/admin/exams/[quizId]/proctor`

The API route should be enhanced to calculate interim score, answered question count, progress percentage, and available class list.

#### Enhanced Data Payload Structure:
```json
{
  "success": true,
  "data": {
    "quiz": {
      "id": "quiz-uuid-123",
      "title": "Ujian Akhir Semester Jaringan Komputer",
      "description": "CBT Evaluasi Semester Ganjil",
      "durationMinutes": 60,
      "maxStrikes": 3,
      "supervisorPin": "884920",
      "enableCameraProctor": false,
      "enableFullscreenLock": true,
      "totalQuestions": 25,
      "totalPoints": 100
    },
    "stats": {
      "totalParticipants": 32,
      "inProgress": 24,
      "locked": 2,
      "submitted": 5,
      "disqualified": 1
    },
    "availableClasses": [
      "X TKJ 1",
      "X TKJ 2",
      "X RPL 1"
    ],
    "attempts": [
      {
        "id": "attempt-uuid-001",
        "userId": "user-uuid-101",
        "userName": "Ahmad Fauzi",
        "phoneNumber": "081234567890",
        "studentClass": "X TKJ 1",
        "status": "IN_PROGRESS",
        "strikeCount": 1,
        "score": 75,
        "totalScore": 100,
        "answeredCount": 20,
        "totalQuestions": 25,
        "progressPercentage": 80,
        "startedAt": "2026-08-30T01:00:00.000Z",
        "submittedAt": null,
        "durationMinutes": 22,
        "updatedAt": "2026-08-30T01:22:15.000Z",
        "violations": [
          {
            "id": "viol-1",
            "type": "TAB_SWITCH",
            "description": "Berpindah tab atau aplikasi lain",
            "timestamp": "2026-08-30T01:15:30.000Z"
          }
        ]
      }
    ]
  }
}
```

### 2.3 Realtime Interim Score Calculation Logic on Server:
When querying `attempts`, if `att.status === 'IN_PROGRESS'`:
1. If `att.answers` exists (synced via R3 progress API):
   - Parse `answers` (JSON array or map).
   - `answeredCount = count of valid answered questions`.
   - `score = interim score computed from correctly answered multiple-choice / checkbox / short-answer questions`.
   - `progressPercentage = Math.round((answeredCount / totalQuestions) * 100)`.
2. If `att.status === 'SUBMITTED'` or `'GRADED'`:
   - `answeredCount = totalQuestions`.
   - `progressPercentage = 100`.
   - `score = att.score`.

---

## 3. Quizizz-Style Gamified Podium & Live Leaderboard

### 3.1 Top 3 Podium Component Specifications
The Top 3 students (ranked by realtime score `desc`, then fastest `durationMinutes` `asc`) are rendered in an Olympic / Quizizz 3-column podium:

```
          ┌──────────────┐
          │  👑 JUARA 1  │
          │     EMAS     │
┌─────────┤  Ahmad (95)  ├─────────┐
│ 🥈 NO 2 │  X TKJ 1     │ 🥉 NO 3 │
│  PERAK  │              │ PERUNGGU│
│Budi (88)│              │Cici (80)│
│ X TKJ 2 │              │ X RPL 1 │
└─────────┴──────────────┴─────────┘
```

#### Podium Card Details:
1. **Rank 1 (Gold / Emas - Center & Tallest)**:
   - Elevation: `scale-105` or higher padding (`p-5 sm:p-6`).
   - Theme: Amber/Gold gradient (`bg-gradient-to-b from-amber-500/20 via-amber-900/40 to-slate-900 border-2 border-amber-400 shadow-xl shadow-amber-500/20`).
   - Header Icon: Crown (`Crown className="w-7 h-7 text-amber-300 animate-bounce"`) with sparkle accents (`Sparkles`).
   - Badge: Gold circle with `1` (`bg-amber-400 text-slate-950 font-black ring-4 ring-amber-300/40`).
   - Score: `font-mono text-lg font-black text-amber-300` (e.g. `95 pts`).
   - Progress: `24/25 Soal (96%)`.
2. **Rank 2 (Silver / Perak - Left Column)**:
   - Elevation: Medium height (`p-4 sm:p-5`).
   - Theme: Slate/Silver gradient (`bg-gradient-to-b from-slate-700/40 to-slate-900/90 border border-slate-400/80 shadow-md`).
   - Badge: Silver circle with `2` (`bg-slate-300 text-slate-900 font-black ring-2 ring-slate-400/40`).
   - Score: `font-mono text-base font-black text-slate-200` (e.g. `88 pts`).
3. **Rank 3 (Bronze / Perunggu - Right Column)**:
   - Elevation: Lower height (`p-4 sm:p-5`).
   - Theme: Bronze gradient (`bg-gradient-to-b from-amber-900/30 to-slate-900/90 border border-amber-700/80 shadow-md`).
   - Badge: Bronze circle with `3` (`bg-amber-700 text-white font-black ring-2 ring-amber-600/40`).
   - Score: `font-mono text-base font-black text-amber-400` (e.g. `80 pts`).

### 3.2 Dynamic Rank Shift Indicator (Smooth Movement)
To give the exhilarating feel of Quizizz where ranks change dynamically:
```ts
// Local state tracking previous poll rankings
const prevRanksRef = useRef<Record<string, number>>({});

// Compute rank shifts whenever sorted attempts change
const getRankShift = (userId: string, currentRank: number) => {
  const prevRank = prevRanksRef.current[userId];
  if (!prevRank) return null;
  const diff = prevRank - currentRank; // positive = moved up
  if (diff > 0) return { direction: "UP", diff };
  if (diff < 0) return { direction: "DOWN", diff: Math.abs(diff) };
  return { direction: "SAME", diff: 0 };
};
```
- **Upward Shift**: Emerald pill with `↑ +2` (`bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold`).
- **Downward Shift**: Rose pill with `↓ -1` (`bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold`).
- **No Change**: Subtle dot or hidden.

### 3.3 Strike Violation Visual Indicators
- **0 Strikes (Clean)**:
  `bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 font-bold text-xs` with `ShieldCheck` icon.
- **1 - 2 Strikes (Warning - Yellow/Amber)**:
  `bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1 font-bold text-xs` with `AlertTriangle` icon (e.g., `⚠️ 1 / 3 Strike`).
- **3 Strikes / Max (Danger - Red & Locked)**:
  `bg-rose-100 text-rose-800 border-rose-300 animate-pulse flex items-center gap-1 font-black text-xs` with `Lock` icon (e.g., `🔒 3 / 3 Strike (Terkunci)`).
- **Disqualified**:
  `bg-slate-100 text-slate-700 line-through font-bold text-xs` with `XCircle` icon.

---

## 4. Quick Proctor Actions & Custom `useDialog` System

Per `AGENTS.md`, **native browser dialogs (`alert()`, `confirm()`, `prompt()`) are strictly prohibited**. All actions must use `useDialog()` from `@/components/ui/DialogProvider`.

### 4.1 Implementation Matrix

```ts
const { confirm, toast } = useDialog();

// 1. UNLOCK ACTION
const handleUnlock = async (att: any) => {
  const ok = await confirm({
    title: "Buka Kunci Ujian Siswa",
    message: `Buka kembali ujian untuk ${att.userName} (${att.studentClass})? Status terkunci akan dinonaktifkan dan strike pelanggaran akan direset ke 0 agar siswa dapat melanjutkan pengerjaan.`,
    confirmText: "Ya, Buka Kunci",
    cancelText: "Batal",
    variant: "info",
    icon: "shield",
  });
  if (!ok) return;
  await executeAction(att.id, "UNLOCK", "Dibuka kuncinya oleh pengawas.");
};

// 2. FORCE SUBMIT ACTION
const handleForceSubmit = async (att: any) => {
  const ok = await confirm({
    title: "Paksa Kumpulkan Ujian",
    message: `Kumpulkan paksa ujian untuk ${att.userName}? Seluruh jawaban yang tersimpan saat ini (${att.answeredCount}/${att.totalQuestions} soal) akan langsung dinilai dan ujian diakhiri.`,
    confirmText: "Ya, Kumpulkan Paksa",
    cancelText: "Batal",
    variant: "warning",
    icon: "send",
  });
  if (!ok) return;
  await executeAction(att.id, "FORCE_SUBMIT", "Dikumpulkan paksa oleh pengawas.");
};

// 3. DISQUALIFY ACTION
const handleDisqualify = async (att: any) => {
  const ok = await confirm({
    title: "Diskualifikasi Peserta",
    message: `PERINGATAN: Apakah Anda yakin ingin mendiskualifikasi ${att.userName}? Nilai siswa akan disetel menjadi 0 dan akses ujian dicabut. Tindakan ini tidak dapat dibatalkan.`,
    confirmText: "Ya, Diskualifikasi",
    cancelText: "Batal",
    variant: "danger",
    icon: "trash",
  });
  if (!ok) return;
  await executeAction(att.id, "DISQUALIFY", "Didiskualifikasi karena pelanggaran berat.");
};

// 4. RESET STRIKES ACTION
const handleResetStrikes = async (att: any) => {
  const ok = await confirm({
    title: "Reset Catatan Strike Pelanggaran",
    message: `Setel ulang pelanggaran untuk ${att.userName} dari ${att.strikeCount} strike menjadi 0?`,
    confirmText: "Ya, Reset Strike",
    cancelText: "Batal",
    variant: "warning",
    icon: "warning",
  });
  if (!ok) return;
  await executeAction(att.id, "RESET_STRIKES", "Poin pelanggaran di-reset.");
};
```

---

## 5. Filters, Search, and Multidimensional Sorting

### 5.1 Filter Controls
1. **Search Bar**: Substring match against `userName`, `phoneNumber`, and `studentClass`.
2. **Status Filter Tabs**:
   - `ALL`: Semua Peserta
   - `IN_PROGRESS`: Sedang Mengerjakan
   - `LOCKED`: Terkunci (Perlu Tindakan)
   - `SUBMITTED`: Selesai Dikumpulkan
   - `DISQUALIFIED`: Didiskualifikasi
3. **Class Filter Dropdown (`<select>`)**:
   - `ALL_CLASSES`: Semua Kelas
   - Dynamically generated options based on `availableClasses` from backend.

### 5.2 Sorting Rules (`sortBy` state)
- **`HIGHEST_SCORE`** (Default / Quizizz Leaderboard):
  1. Score `desc`
  2. Answered count `desc`
  3. Duration `asc`
- **`FASTEST`** (Paling Cepat / Progress Terdepan):
  1. Submitted status first with lowest `durationMinutes`
  2. In-progress students with highest `progressPercentage`
- **`MOST_VIOLATIONS`** (Pelanggaran / Strike Terbanyak):
  1. `strikeCount` `desc`
  2. Locked status first
- **`NAME_ASC`** (Nama A - Z):
  1. Alphabetical sorting on `userName`

---

## 6. Mobile Responsiveness Architecture (< 640px)

Per `AGENTS.md`: Every UI element must look clean, usable, and touch-friendly on smartphone screens.

### 6.1 Layout Adaptations:
1. **Header & Control Bar**:
   - Stacked vertically on mobile (`flex-col sm:flex-row sm:items-center justify-between gap-4`).
   - Supervisor PIN badge remains prominent and easily legible for on-duty proctors.
2. **Stat Cards**:
   - `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3` with compact spacing.
3. **Podium Cards on Mobile**:
   - Widths and text sizes adjust down (`text-xs sm:text-sm`, `max-w-[85px] sm:max-w-[140px]` truncate).
   - Podium maintains 3-column layout side-by-side so the visual excitement is preserved on small screens without breaking layout or horizontal overflowing.
4. **Filter Bar on Mobile**:
   - Class selector, sorting selector, and search input stack vertically (`flex-col sm:flex-row gap-2.5`).
   - Status tabs have `overflow-x-auto pb-1` with smooth horizontal touch-scrolling.
5. **Participant List: Responsive Table with Mobile Card Fallback / Touch Actions**:
   - Table wrapper has `overflow-x-auto shadow-sm rounded-3xl`.
   - On compact screens, touch targets for action buttons are properly sized (`min-h-[36px]`, `px-3 py-1.5`) to prevent misclicks.

---

## 7. Implementation Checklist & Verification Plan

### 7.1 Backend Changes
- [ ] Update `src/app/api/admin/exams/[quizId]/proctor/route.ts`:
  - Compute `answeredCount`, `totalQuestions`, `progressPercentage`, `durationMinutes`, and realtime `score` from attempts.
  - Return `availableClasses` array.
- [ ] Verify `src/app/api/admin/exams/[quizId]/action/route.ts` correctly handles `UNLOCK`, `FORCE_SUBMIT`, `DISQUALIFY`, and `RESET_STRIKES`.

### 7.2 Frontend Changes
- [ ] Upgrade `src/app/admin/exams/[quizId]/proctor/page.tsx`:
  - Add Quizizz-style Top 3 Podium (Gold, Silver, Bronze) with crown/medal badges and live points.
  - Implement 3.0s polling interval (`setInterval(..., 3000)`).
  - Implement rank tracking with `useRef` to display dynamic `↑` and `↓` rank movements.
  - Add Class filter dropdown and Sorting dropdown (`HIGHEST_SCORE`, `FASTEST`, `MOST_VIOLATIONS`, `NAME_ASC`).
  - Add live progress bars (e.g. `18/25 Soal (72%)`) and strike indicator badges (Green / Yellow / Red).
  - Connect all proctor buttons (`Unlock`, `Force Submit`, `Disqualify`, `Reset Strikes`) to `useDialog().confirm` and `useDialog().toast`.
  - Ensure 100% responsive styling (< 640px) per `AGENTS.md`.

### 7.3 Verification Method
1. **Type & Build Verification**:
   - Run `npm run build` or `npx tsc --noEmit` to ensure 0 TypeScript compilation errors.
2. **Functional Verification**:
   - Check proctor route `/admin/exams/[quizId]/proctor` in browser.
   - Verify podium displays Top 3 students with Gold/Silver/Bronze styling.
   - Verify 3-second live polling without layout flicker.
   - Verify filters (Class filter, Status tabs, Search) and Sorting modes.
   - Verify action dialogs open with custom `useDialog` and execute successfully.
   - Test responsive layout on mobile viewport (width 360px - 414px) and tablet/desktop.

---

**Report Status:** Complete & Ready for Implementation / Handoff.
