# In-Depth Analysis: Window of Availability Scheduling, Student Quiz Runner & Timer Bugfixes

**Author**: `m1_explorer_3`  
**Milestone**: Milestone 1 (Window of Availability Scheduling - Student Quiz Runner & Timer Bugfixes)  
**Date**: 2026-08-30  
**Target Files**:
- `src/app/student/quiz/[quizId]/page.tsx`
- `src/app/api/quiz/[quizId]/start/route.ts`
- `src/components/exam/ExamPreCheckModal.tsx`
- `src/app/api/quiz/[quizId]/route.ts`

---

## 1. Executive Summary

This report provides the full architectural and code-level investigation for the Student Quiz Runner (`/student/quiz/[quizId]`) and start API endpoint (`/api/quiz/[quizId]/start`). It addresses four core problem areas:
1. **Window Gating States**: Implementing dedicated gating views for upcoming exams (with a live ticking countdown timer to `openAt` and auto-unlock capability) and expired exams (when `now > closeAt`), while guaranteeing personal timer tolerance for active ongoing attempts.
2. **Timer Reset Bug on Page Refresh / Resume**: Resolving the critical flaw where `timeLeftSeconds` reset back to full duration on every page reload or browser restart.
3. **Exam Token Payload Mismatch**: Resolving the discrepancy between `{ examToken: token }` in `page.tsx` vs `{ token: token }` in `start/route.ts`, plus the modal argument passing flaw.
4. **Backend Start Route Hardening**: Comprehensive audit of `/api/quiz/[quizId]/start/route.ts` for window checks, token validation, and attempt resume handling.

---

## 2. Detailed Findings & Root Cause Analysis

### 2.1 Window Gating States in `src/app/student/quiz/[quizId]/page.tsx`

#### Current Flow
Currently, `fetchQuizData()` fetches `/api/quiz/[quizId]`. If `attempt` is null, it immediately sets `showPreCheck(true)`. The student sees the Pre-Check verification modal, checks the agreement box, enters a token (if required), and clicks "Mulai Ujian Sekarang". Only at that point does `POST /api/quiz/[quizId]/start` return a 403 error toast:
- `"Ujian belum dibuka. Ujian akan dibuka pada..."` OR
- `"Waktu pengerjaan ujian telah berakhir / ditutup."`

#### Flaws Identified
1. **No Advance Gating**: Students are allowed into the Pre-Check modal even when an exam is not yet open or has already closed.
2. **No Countdown Timer**: There is no live ticking countdown clock informing students how much time remains until `openAt`.
3. **No Auto-Unlock**: Students have to guess when the exam opens and manually refresh.
4. **No Dedicated Expired Screen**: Closed exams only trigger a toast instead of a clear, informative status screen with navigation back to `/student/exams`.

#### Required State Transition Matrix
| Window Condition | Student Attempt State | Preview Mode | Screen to Display |
|---|---|---|---|
| `now < openAt` | No active attempt (`null` or new) | `false` | **Dedicated "Ujian Belum Dibuka" Screen** with live countdown to `openAt` and auto-unlock |
| `now < openAt` | Active attempt (`IN_PROGRESS`/`LOCKED`) | `false` | Resume exam workspace with personal remaining time |
| `now > closeAt` | No active attempt (`null` or not started) | `false` | **Dedicated "Ujian Telah Ditutup" Screen** with back button |
| `now > closeAt` | Started before `closeAt` (`IN_PROGRESS`/`LOCKED`) | `false` | **Full Personal Timer Tolerance**: Resume exam workspace until personal duration finishes |
| `openAt <= now <= closeAt` | No attempt | `false` | `ExamPreCheckModal` (Ready to Start) |
| Any window state | Completed (`SUBMITTED`/`GRADED`/`DISQUALIFIED`) | `false` | Result / Completed / Disqualified Screen |
| Any window state | Any | `true` (Admin) | Admin Preview Mode (Window gating bypassed, banner shown) |

---

### 2.2 Bug Fix 1: Timer Reset Bug on Resume

#### Root Cause
In `src/app/student/quiz/[quizId]/page.tsx`:
```ts
// Lines 154-156
// Initialize duration timer
const totalSecs = (qData.durationMinutes || 30) * 60;
setTimeLeftSeconds(totalSecs);
```
`fetchQuizData()` unconditionally executed `setTimeLeftSeconds(totalSecs)` on every load. When an ongoing attempt (`IN_PROGRESS`) was resumed, `att.status === "IN_PROGRESS"` set `hasStarted(true)`, but the remaining time was overwritten with the full `durationMinutes * 60` (e.g. 1800s for a 30-minute quiz).

#### Solution
1. `GET /api/quiz/[quizId]` already computes `attempt.remainingDurationSecs` based on `startedAt`:
   ```ts
   const elapsedSecs = Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000);
   remainingDurationSecs = Math.max(0, (quiz.durationMinutes * 60) - elapsedSecs);
   ```
2. In `fetchQuizData()`, initialize `timeLeftSeconds` as:
   ```ts
   if (att && att.startedAt && (att.status === "IN_PROGRESS" || att.status === "LOCKED")) {
     const remaining = typeof att.remainingDurationSecs === "number"
       ? att.remainingDurationSecs
       : Math.max(0, (qData.durationMinutes || 30) * 60 - Math.floor((Date.now() - new Date(att.startedAt).getTime()) / 1000));
     setTimeLeftSeconds(remaining);

     // If remaining time has elapsed while offline, trigger auto-submit
     if (att.status === "IN_PROGRESS" && remaining <= 0) {
       setTimeout(() => {
         handleAutoSubmitOnTimeout();
       }, 500);
     }
   } else {
     const totalSecs = (qData.durationMinutes || 30) * 60;
     setTimeLeftSeconds(totalSecs);
   }
   ```
3. In `handleStartExam()`: When a new attempt is created, update `timeLeftSeconds` with `json.data.remainingDurationSecs` returned from `/api/quiz/[quizId]/start`.

---

### 2.3 Bug Fix 2: Exam Token Payload Mismatch

#### Root Cause
1. In `src/app/student/quiz/[quizId]/page.tsx`:
   Line 291:
   ```ts
   body: JSON.stringify({ examToken: token }),
   ```
2. In `src/app/api/quiz/[quizId]/start/route.ts`:
   Line 97:
   ```ts
   const userToken = (body.token || "").trim().toUpperCase();
   ```
   The server looked for `body.token` instead of `body.examToken`.
3. In `src/components/exam/ExamPreCheckModal.tsx`:
   Line 193:
   ```tsx
   <button onClick={onStartExam} ...>
   ```
   `onStartExam` was called with 0 arguments, so `token` in `handleStartExam(token?: string)` was `undefined`, and `page.tsx` did not fall back to `examTokenInput` state.

#### Solution
- **Modal Component (`ExamPreCheckModal.tsx`)**:
  Call `onStartExam(examTokenInput)` or provide fallback.
- **Page Component (`page.tsx`)**:
  In `handleStartExam`:
  ```ts
  const tokenToSend = (token || examTokenInput || "").trim();
  const res = await fetch(`/api/quiz/${quizId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: tokenToSend, examToken: tokenToSend }),
  });
  ```
- **API Route (`start/route.ts`)**:
  ```ts
  const userToken = (body.token || body.examToken || "").trim().toUpperCase();
  ```

---

### 2.4 Review of `/api/quiz/[quizId]/start/route.ts`

#### Route Audit & Recommendations
1. **Window Checks**:
   - `openAt`: Blocks new attempts if `now < openAt`. (Solid).
   - `closeAt`: Allows resume if `hasActiveAttempt` (`IN_PROGRESS` or `LOCKED`), blocks new attempts if `now > closeAt`. (Solid).
2. **Token Check**:
   - Validates `userToken === expectedToken`.
   - Update to accept both `body.token` and `body.examToken`.
3. **Completed Attempts**:
   - If attempt is already `SUBMITTED`, `GRADED`, or `DISQUALIFIED`, return current state with `remainingDurationSecs: 0` without altering database.
4. **Duration Calculation**:
   - Accurately computes `remainingDurationSecs = Math.max(0, (quiz.durationMinutes * 60) - elapsedSecs)`.

---

## 3. Concrete Implementation Blueprint

### 3.1 Proposed Structure for `src/app/student/quiz/[quizId]/page.tsx`

```tsx
// Gating State Calculation in Component:
const now = new Date();
const hasActiveAttempt = Boolean(attempt && (attempt.status === "IN_PROGRESS" || attempt.status === "LOCKED"));
const hasCompletedAttempt = Boolean(attempt && (attempt.status === "SUBMITTED" || attempt.status === "GRADED" || attempt.status === "DISQUALIFIED"));

const isUpcoming = Boolean(quiz?.openAt && now < new Date(quiz.openAt)) && !hasActiveAttempt && !hasCompletedAttempt && !isPreview;
const isExpired = Boolean(quiz?.closeAt && now > new Date(quiz.closeAt)) && !hasActiveAttempt && !hasCompletedAttempt && !isPreview;

// Countdown State for Upcoming Screen:
const [countdownSeconds, setCountdownSeconds] = useState<number>(0);

useEffect(() => {
  if (!isUpcoming || !quiz?.openAt) return;

  const calculateRemaining = () => {
    const diff = Math.max(0, Math.floor((new Date(quiz.openAt).getTime() - Date.now()) / 1000));
    setCountdownSeconds(diff);
    if (diff <= 0) {
      // Auto-unlock: refresh quiz data to transition seamlessly into ready state
      fetchQuizData();
    }
  };

  calculateRemaining();
  const interval = setInterval(calculateRemaining, 1000);
  return () => clearInterval(interval);
}, [isUpcoming, quiz?.openAt]);
```

### 3.2 UI Design for "Ujian Belum Dibuka" Screen

```tsx
if (isUpcoming) {
  const days = Math.floor(countdownSeconds / 86400);
  const hours = Math.floor((countdownSeconds % 86400) / 3600);
  const minutes = Math.floor((countdownSeconds % 3600) / 60);
  const seconds = countdownSeconds % 60;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
      <div className="w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-200">
        <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto animate-pulse shadow-lg shadow-amber-500/20">
          <Calendar className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-700 text-xs font-black uppercase tracking-wider">
            UJIAN BELUM DIBUKA
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">{quiz.title}</h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
            Sesi ujian ini dijadwalkan dibuka secara otomatis saat hitung mundur mencapai waktu mulai.
          </p>
        </div>

        {/* Live Countdown Grid */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30">
          <div className="text-xs font-bold text-amber-400 mb-3 flex items-center justify-center gap-1.5">
            <Clock className="w-4 h-4 animate-spin" />
            <span>HITUNG MUNDUR PEMBUKAAN UJIAN</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">{String(days).padStart(2, "0")}</div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Hari</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">{String(hours).padStart(2, "0")}</div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Jam</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">{String(minutes).padStart(2, "0")}</div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Menit</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-2xl sm:text-3xl font-black font-mono text-amber-400">{String(seconds).padStart(2, "0")}</div>
              <span className="text-[10px] text-slate-400 font-bold uppercase">Detik</span>
            </div>
          </div>
        </div>

        {/* Exam Schedule Meta */}
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Jadwal Dibuka:</span>
            <span className="font-bold text-white">
              {new Date(quiz.openAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} WIB
            </span>
          </div>
          {quiz.closeAt && (
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">Jadwal Ditutup:</span>
              <span className="font-bold text-white">
                {new Date(quiz.closeAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} WIB
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Durasi Pengerjaan:</span>
            <span className="font-bold text-white">{quiz.durationMinutes} Menit</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Jumlah Soal:</span>
            <span className="font-bold text-white">{quiz.questions?.length || 0} Soal</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          <button
            onClick={() => fetchQuizData()}
            className="w-full py-3 px-5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Cek Status / Muat Ulang</span>
          </button>
          <button
            onClick={() => router.push("/student/exams")}
            className="w-full py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-700 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Pusat Ujian</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 3.3 UI Design for "Ujian Telah Ditutup / Berakhir" Screen

```tsx
if (isExpired) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in duration-200">
        <div className="w-20 h-20 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto shadow-lg">
          <Clock className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-xs font-black uppercase tracking-wider">
            UJIAN TELAH DITUTUP
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white">{quiz.title}</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Waktu pengerjaan untuk ujian ini telah berakhir pada{" "}
            <strong className="text-slate-200">
              {new Date(quiz.closeAt).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })} WIB
            </strong>
            . Anda belum sempat memulai ujian selama jendela waktu yang tersedia.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Durasi Pengerjaan:</span>
            <span className="font-bold text-white">{quiz.durationMinutes} Menit</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-slate-400">Total Soal:</span>
            <span className="font-bold text-white">{quiz.questions?.length || 0} Soal</span>
          </div>
        </div>

        <button
          onClick={() => router.push("/student/exams")}
          className="w-full py-3.5 px-6 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-700 transition-all shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Pusat Ujian CBT</span>
        </button>
      </div>
    </div>
  );
}
```

---

## 4. Summary of Planned Edits

| File | Target Lines / Section | Purpose |
|---|---|---|
| `src/app/student/quiz/[quizId]/page.tsx` | Lines 90-165 (`fetchQuizData`) | Fix timer initialization to use `att.remainingDurationSecs` when resuming ongoing attempt |
| `src/app/student/quiz/[quizId]/page.tsx` | Lines 285-310 (`handleStartExam`) | Use `(token \|\| examTokenInput)` and payload `{ token, examToken }` |
| `src/app/student/quiz/[quizId]/page.tsx` | Lines 455-465 | Add `isUpcoming` waiting screen with live countdown timer and `isExpired` screen |
| `src/components/exam/ExamPreCheckModal.tsx` | Lines 26, 193 | Pass `examTokenInput` on `onStartExam(examTokenInput)` |
| `src/app/api/quiz/[quizId]/start/route.ts` | Lines 95-110 | Accept both `body.token` and `body.examToken` |
