# Comprehensive Analysis Report: Realtime Live Proctor & Gamified Leaderboard (Quizizz Style)

## 1. Executive Summary

This investigation surveys the architecture, existing codebase, API endpoints, data models, and UI/UX requirements for implementing the **Realtime Live Proctor Dashboard and Quizizz-Style Gamified Leaderboard** in VeloNet CBT (`/admin/exams/[quizId]/proctor`).

The system enables teachers and exam supervisors (pengawas ujian) to monitor all active students in real time (polling every 3 seconds), track live question completion progress with per-question visual indicators, observe dynamic leaderboard podium shifts as students earn points, detect cheating strikes (Yellow 1-2, Red 3), and perform immediate supervisor interventions (Unlock, Force Submit, Kick/Disqualify) backed by safe custom confirmation dialogs (`useDialog`).

---

## 2. Codebase Architecture & Key Files Surveyed

### 2.1 File Map

| Component / Route | File Location | Purpose & Current State |
|---|---|---|
| **Admin Proctor Page** | `src/app/admin/exams/[quizId]/proctor/page.tsx` | Main supervisor control room. Currently has basic table and 3.5s polling. Needs Top 3 Podium, 3s polling, dynamic rank transitions, per-question progress matrix, live scores, class filters, and sorting. |
| **Admin Proctor API** | `src/app/api/admin/exams/[quizId]/proctor/route.ts` | Feeds proctoring data. Needs to include ordered question metadata (`quiz.questions`) and `answeredQuestionIds` for per-question visual dots. |
| **Admin Action API** | `src/app/api/admin/exams/[quizId]/action/route.ts` | Executes supervisor controls: `UNLOCK`, `RESET_STRIKES`, `FORCE_SUBMIT`, `DISQUALIFY`. |
| **Student Quiz Runner** | `src/app/student/quiz/[quizId]/page.tsx` | Student CBT client with fullscreen/tab lock, timer, local storage draft recovery, and violation handling. Needs background calling to `/api/quiz/[quizId]/progress`. |
| **Progress Sync API** | `src/app/api/quiz/[quizId]/progress/route.ts` | Granular answer upsert and realtime score aggregation. |
| **Custom Dialog Provider** | `src/components/ui/DialogProvider.tsx` | Mandatory UI standard for all confirmations and toast notifications (`useDialog`). |
| **Prisma Schema** | `prisma/schema.prisma` | Defines `Quiz`, `Question`, `Option`, `QuizAttempt`, `QuizStudentAnswer`, and `ExamViolationLog`. |

---

## 3. Deep-Dive Requirement Analysis

### 3.1 R1 & R2 Realtime Polling & Sync Mechanism
- **Polling Interval**: Set to **3000ms (3 seconds)** in `ExamProctorControlRoom`.
- **Concurrency & Stacking Guard**: Polling loop should utilize an `isFetchingRef` or timestamp guard so that on high-latency networks, fetch requests do not stack or cause race conditions.
- **Heartbeat & Status Indicator**: Visual pulsating badge with a live countdown or pulse ring indicating realtime active connection to the server.

### 3.2 Top 3 Gamified Podium (Quizizz Style)
- **Podium Visual Layout (Olympic 2-1-3)**:
  - **Rank 1 (Gold - Juara 1)**: Center position, tallest pedestal / highlighted card with glowing gold border (`border-amber-400`, `bg-amber-500/10`), crown / animated trophy icon, avatar/initials, student name, class, realtime points, % completed progress bar.
  - **Rank 2 (Silver - Juara 2)**: Left position, 2nd height pedestal with silver gradient (`border-slate-300`, `bg-slate-200/50`), medal icon, score, % completed.
  - **Rank 3 (Bronze - Juara 3)**: Right position, 3rd height pedestal with bronze gradient (`border-amber-700/50`, `bg-amber-900/10`), medal icon, score, % completed.
- **Dynamic Rank Transitions**:
  - Store previous poll rankings in local state (`prevRanksMap: Record<string, number>`).
  - When ranks shift, render dynamic movement tags:
    - `↑ +N` (Emerald green badge: Naik peringkat)
    - `↓ -N` (Rose red badge: Turun peringkat)
    - `-` (Slate badge: Posisi stabil)
  - Animated CSS transition effects for smooth score increment numbers.

### 3.3 Live Participant List & Progress Matrix
- **Realtime Score**:
  - Displays current temporary points accumulated as students answer questions correctly in realtime (e.g. `80 / 100 Poin`).
- **Progress Bar & Per-Question Visual Indicators**:
  - Quantitative percentage: `progressPercentage` (e.g., `85% • 17/20 Soal`).
  - Visual dot matrix: Grid/row of mini dots/squares for questions 1..N:
    - **Green Dot (`bg-emerald-500`)**: Question answered.
    - **Gray Dot (`bg-slate-200`)**: Question unanswered.
- **Connection & Proctoring Status**:
  - `IN_PROGRESS`: Green badge with live animated ping dot ("Aktif Mengerjakan").
  - `LOCKED`: Rose pulsing badge with lock icon ("Terkunci Pelanggaran" - Butuh Aksi).
  - `SUBMITTED`: Blue badge with check icon ("Selesai Dikumpulkan").
  - `DISQUALIFIED`: Gray/Red badge with X icon ("Didiskualifikasi - Skor 0").
- **Strike Violation Indicators**:
  - `0 Strike`: Green badge ("0/3 Bersih").
  - `1-2 Strike`: Yellow/Amber warning badge ("1/3 Strike" / "2/3 Strike - Peringatan").
  - `3 Strike`: Red critical badge ("3/3 Strike - Terkunci / Diskualifikasi").
  - Tooltip/preview of the latest logged violation (e.g., `TAB_SWITCH: Berpindah tab browser`, `FULLSCREEN_EXIT`).

### 3.4 Quick Proctor Action Controls
All supervisor actions are invoked per row with instant custom confirmation modal via `useDialog().confirm()`:
1. **Unlock (Buka Kunci)**:
   - Sets `status = 'IN_PROGRESS'` and `strikeCount = 0`.
   - Logs `REMOTE_UNLOCKED` in `ExamViolationLog`.
   - Restores student access on their client screen.
2. **Force Submit (Paksa Kumpulkan)**:
   - Calculates score from current answers, marks `status = 'SUBMITTED'`, timestamps `submittedAt`.
   - Logs `FORCE_SUBMITTED` in `ExamViolationLog`.
3. **Kick / Disqualify (Diskualifikasi)**:
   - Marks `status = 'DISQUALIFIED'`, resets `score = 0`.
   - Logs `DISQUALIFIED` in `ExamViolationLog`.
4. **Reset Strike**:
   - Resets `strikeCount = 0` while keeping current attempt status.

### 3.5 Filtering, Searching & Sorting
- **Class Filter**: Dynamic dropdown populated from unique `studentClass` values of all attempts (e.g., "Semua Kelas", "XII RPL 1", "XII TKJ 2").
- **Status Filter**: Tab filters ("Semua", "Terkunci", "Mengerjakan", "Selesai", "Didiskualifikasi").
- **Search Bar**: Live search by student name, NISN/phone number, or class name.
- **Sorting Options**:
  - `Skor Tertinggi (Leaderboard / Peringkat)` (Default)
  - `Paling Cepat / Progress Terbanyak`
  - `Pelanggaran Terbanyak (Strike Terbanyak)`
  - `Nama Siswa (A - Z)`

---

## 4. UI/UX Standards Compliance (`AGENTS.md`)

| Requirement | Rule in AGENTS.md | Implementation Strategy |
|---|---|---|
| **Custom UI Dialogs** | STRICTLY NO native `alert()`, `confirm()`, `prompt()`. | All supervisor confirmations (Unlock, Force Submit, Disqualify) and feedback notifications strictly use `const { confirm, toast } = useDialog()` from `@/components/ui/DialogProvider`. |
| **Mobile Responsiveness (< 640px)** | 100% responsive on smartphones. | - Datatable wrapped in `overflow-x-auto`.<br>- Headers and action button bars use `flex-col sm:flex-row flex-wrap`.<br>- Podium converts to stacked responsive cards or compact columns.<br>- Stat cards use `grid-cols-2 sm:grid-cols-2 lg:grid-cols-5`.<br>- Touch targets >= 36-44px. |
| **Media & Assets** | Runtime uploads served via valid Route Handlers. | Handled via existing standard route `/uploads/...`. |
| **Proctoring Defaults** | Mobile priority; Webcam proctoring `@default(false)`. | Preserved in schema and settings. |

---

## 5. Technical Specification & Implementation Plan

### Step 1: Update API Route `/api/admin/exams/[quizId]/proctor/route.ts`
- Include ordered question list `quiz.questions: { id, order, points }` ordered by `order asc`.
- Map `answeredQuestionIds` for each attempt by inspecting non-empty answers in `detailedAnswers`.
- Return sorted attempts by realtime score descending.

### Step 2: Build Realtime Quizizz-Style Podium & Dynamic Transitions
- Create Top 3 Podium component in `src/app/admin/exams/[quizId]/proctor/page.tsx`.
- Track rank transitions between poll cycles (`prevRanksMap`).
- Render gold/silver/bronze badges, crown animations, points, and rank delta badges (`↑`, `↓`, `=`).

### Step 3: Upgrade Live Participant Table & Per-Question Visual Matrix
- Render realtime score (`pts`).
- Render question progress percentage bar + mini dots matrix (`answeredQuestionIds.includes(q.id) ? emerald : slate`).
- Render colored strike badges (Yellow for 1-2 strikes, Red for 3 strikes).
- Add class filter dropdown and sort selectors.

### Step 4: Verify Student Background Progress Sync in `src/app/student/quiz/[quizId]/page.tsx`
- Ensure when student selects or changes answers, `/api/quiz/[quizId]/progress` is called asynchronously without lag.

### Step 5: Verification & Type-Check
- Run `npm run build` and test all proctor controls and responsiveness.
