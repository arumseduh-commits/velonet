# In-Depth Analysis: Student Exam Hub, Quiz Runner, Window of Availability, and Interim Progress Synchronization

**Explorer Agent**: `survey_explorer_2`  
**Date**: 2026-08-30  
**Target Subsystems**:
1. Student Exam Hub (`/student/exams`, `src/app/student/exams/page.tsx`, `src/app/api/student/exams/route.ts`)
2. Student Quiz Runner (`/student/quiz/[quizId]`, `src/app/student/quiz/[quizId]/page.tsx`, related components & hooks)
3. Window of Availability Restrictions (`openAt`, `closeAt` lifecycle & enforcement)
4. Fast Interim Progress & Score Synchronization (`/api/quiz/[quizId]/progress`)

---

## 1. Executive Summary

This investigation analyzed the student-side CBT (Computer-Based Test) experience in VeloNet, specifically addressing:
1. **Exam Availability Windows (`openAt` & `closeAt`)**: Ensuring students cannot access or start exams before the designated start time (`openAt`) or after the closing deadline (`closeAt`), while protecting students who started legitimately before `closeAt` so they can complete their remaining personal timer duration.
2. **Realtime Interim Progress & Score Synchronization (`/api/quiz/[quizId]/progress`)**: Currently, answer selections exist solely in client-side React state and `localStorage` until final submission (`/api/quiz/submit`). The background progress sync API route (`/api/quiz/[quizId]/progress`) was built but is **never invoked by the client runner**. This causes the Live Proctor Dashboard to show zero real-time progress and exposes student answers to data loss upon abrupt disconnection or forced submission.
3. **Timer & Token Discrepancies**: Discovered critical bugs where page reloads reset the in-progress countdown timer back to full duration, and token payload mismatch (`body.token` vs `body.examToken`) between runner and start API.

---

## 2. Component & API Inventory

| Path | File | Role & Current State |
|---|---|---|
| `/student/exams` | `src/app/student/exams/page.tsx` | Student exam list. Lacks `openAt`/`closeAt` visual countdowns, upcoming badges, and closed status handling. |
| `/api/student/exams` | `src/app/api/student/exams/route.ts` | Returns exam list with `openAt`, `closeAt`, and calculated `availability` (`UPCOMING`, `OPEN`, `CLOSED`). Frontend does not yet utilize these fields. |
| `/student/quiz/[quizId]` | `src/app/student/quiz/[quizId]/page.tsx` | Main CBT exam runner. Handles pre-check, security hooks, questions, strikes, timer, and submission. Lacks window blocking screens and background progress sync calls. |
| `/api/quiz/[quizId]` | `src/app/api/quiz/[quizId]/route.ts` | Returns quiz details and student attempt. Currently lacks server-side `openAt`/`closeAt` gatekeeping for unauthorized GET access. |
| `/api/quiz/[quizId]/start` | `src/app/api/quiz/[quizId]/start/route.ts` | Initializes student attempt. Has `openAt`/`closeAt` validation, but contains a token parameter mismatch (`body.token` vs `body.examToken`). |
| `/api/quiz/[quizId]/progress` | `src/app/api/quiz/[quizId]/progress/route.ts` | Upserts `QuizStudentAnswer`, computes interim score, updates `QuizAttempt.score`. Fully implemented on server, but not called by frontend. |
| `/api/quiz/submit` | `src/app/api/quiz/submit/route.ts` | Finalizes exam attempt, grades responses, awards XP and badges. |
| `/api/quiz/[quizId]/violation` | `src/app/api/quiz/[quizId]/violation/route.ts` | Handles anti-cheat strikes, wipes answers on strikes 1 & 2, permanently disqualifies on strike 3. |
| `/api/quiz/[quizId]/unlock` | `src/app/api/quiz/[quizId]/unlock/route.ts` | Unlocks locked attempts via Supervisor PIN. |
| `useExamSecurity` | `src/hooks/useExamSecurity.ts` | Monitors fullscreen, tab switch (`visibilitychange`), `pagehide`, window blur, devtools, and keyboard shortcuts. |

---

## 3. Window of Availability Restrictions (`openAt`, `closeAt`)

### 3.1 State Transition Matrix

| Scenario | Condition | UI Behavior (`/student/exams`) | UI Behavior (`/student/quiz/[quizId]`) | API Gatekeeping (`/api/quiz/...`) |
|---|---|---|---|---|
| **State 1: Upcoming** | `now < openAt` | Badge: `Ujian Belum Dibuka`<br>Countdown: Live timer until `openAt`<br>Button: Disabled `Belum Dibuka` (with Lock icon) | Dedicated "Ujian Belum Dibuka" Screen with live countdown (`HH:MM:SS`). Disables pre-check until countdown reaches 0. | `GET /api/quiz/[quizId]` returns `availability: "UPCOMING"`, sanitizes questions.<br>`POST /api/quiz/[quizId]/start` returns `403 Forbidden`. |
| **State 2: Active Window** | `openAt <= now <= closeAt` (or no dates) | Badge: `Tersedia / Aktif`<br>Button: `Ikuti Ujian` / `Lanjutkan Ujian` | Displays `ExamPreCheckModal` (or resumes active attempt). | Full access allowed. |
| **State 3: Expired / Closed (Not Started)** | `now > closeAt && !attempt?.startedAt` | Badge: `Ujian Telah Ditutup`<br>Button: Disabled `Waktu Habis` | Dedicated "Ujian Telah Ditutup / Berakhir" screen with explanation that window has passed. | `POST /api/quiz/[quizId]/start` returns `403 Forbidden`. |
| **State 4: Started Before CloseAt, Running Past CloseAt** | `attempt.startedAt <= closeAt && now > closeAt && status === "IN_PROGRESS"` | Badge: `Sedang Dikerjakan`<br>Button: `Lanjutkan Ujian` | **Allowed to continue uninterrupted** until personal duration timer (`durationMinutes`) expires. | API permits `/progress`, `/violation`, and `/submit` for the active attempt. |
| **State 5: Completed / Graded** | `status IN ["SUBMITTED", "GRADED", "DISQUALIFIED"]` | Badge: `Selesai` / `Didiskualifikasi`<br>Button: `Lihat Hasil Ujian` | Displays Completed / Disqualified score view. | View permitted; modifications rejected. |

### 3.2 Key Technical Specifications

1. **Date Sanitization & Timezone Handling**:
   - `openAt` and `closeAt` are stored in UTC in PostgreSQL and sent as ISO 8601 strings (`.toISOString()`).
   - Formatting on the client must use Indonesian locale (`id-ID`) with `WIB` display (e.g. `Senin, 31 Ags 2026, 08:00 WIB`).
2. **Client-Side Live Countdown**:
   - A reactive helper `useCountdown(targetDate)` or inline 1-second interval to compute `hours`, `minutes`, `seconds` until `openAt`.
   - When countdown hits 0, auto-transition to open state without requiring manual page reload.
3. **Personal Timer vs Global Window**:
   - The personal timer is computed as:
     $$\text{remainingSecs} = \max\left(0, (\text{durationMinutes} \times 60) - \left\lfloor \frac{\text{now} - \text{startedAt}}{1000} \right\rfloor\right)$$
   - The student is never prematurely cut off at `closeAt` if they started before `closeAt`; their personal countdown continues until $\text{remainingSecs} = 0$.

---

## 4. Student Answer State & Interim Progress/Score Synchronization

### 4.1 Root Cause of Current Disconnect
In `src/app/student/quiz/[quizId]/page.tsx`:
- `handleSelectOption`, `handleToggleMultipleOption`, and `handleTextResponseChange` update local state `answers` and write to `localStorage`.
- No HTTP request is dispatched until `doSubmitExam()` calls `/api/quiz/submit`.
- Meanwhile, the Proctor Dashboard (`/admin/exams/[quizId]/proctor`) queries `QuizStudentAnswer` and `QuizAttempt.score`, which remain completely empty throughout the exam session!

### 4.2 Synchronization Architecture Design

```
[ Student Action ] 
  ├──> Instant Optimistic UI Update (0ms delay)
  ├──> LocalStorage Draft Cache (Offline fallback)
  └──> Background Sync Manager (`syncProgress`)
         ├── MCQ / TF / Checkbox -> Dispatched immediately / 200ms debounce
         └── Essay / Short Answer -> Debounced 800ms - 1000ms
                  │
                  ▼
         `POST /api/quiz/[quizId]/progress`
                  │
                  ├── 1. Upsert `QuizStudentAnswer` (questionId, optionIds, textResponse, auto-points)
                  ├── 2. Sum earned points across all student answers
                  ├── 3. Update `QuizAttempt.score = currentScore` & `QuizAttempt.answers = JSON(answersMap)`
                  │
                  ▼
         [ 200 OK Response ] -> Update UI Sync Status Indicator ("Tersimpan ✓")
```

### 4.3 Detailed Sync Design Specifications

1. **Payload Structure**:
   ```typescript
   interface SyncProgressPayload {
     questionId: string;
     optionId?: string;
     selectedOptionIds?: string[];
     textResponse?: string;
     answersMap: Record<string, {
       optionId?: string;
       selectedOptionIds?: string[];
       textResponse?: string;
     }>;
   }
   ```
2. **Debouncing & Concurrency Control**:
   - For option selections (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `TRUE_FALSE`): Trigger sync immediately or with minimal debounce (200ms).
   - For text inputs (`SHORT_ANSWER`, `ESSAY`): Use a `useRef` debounce timer of 800ms–1000ms to avoid flooding the database per keystroke.
   - Use an `AbortController` or sequence counter to discard stale in-flight responses if a newer change was already dispatched.
3. **Sync Indicator UI**:
   - Add a subtle status pill in the runner header:
     - `Syncing`: `CloudUpload` icon spinning, "Menyimpan jawaban..." (amber/blue)
     - `Synced`: `CheckCircle2` icon, "Tersimpan" (emerald)
     - `Error`: `AlertTriangle` icon, "Tersimpan lokal (offline)" (rose)
4. **Performance & Database Impact**:
   - `QuizStudentAnswer` table has a composite unique index on `@@unique([attemptId, questionId])`.
   - Upsert queries execute in ~5-15ms on PostgreSQL.
   - The proctor dashboard polls every 3s, consuming pre-aggregated `score` and `detailedAnswers` without table lock contention.

---

## 5. Identified Bugs & Required Fixes

### 5.1 Timer Reset Bug on Page Reload
- **Observation**: In `src/app/student/quiz/[quizId]/page.tsx` (lines 155-156):
  ```typescript
  const totalSecs = (qData.durationMinutes || 30) * 60;
  setTimeLeftSeconds(totalSecs);
  ```
  When an existing attempt was loaded, `totalSecs` was initialized to full `durationMinutes * 60`, completely ignoring `att.remainingDurationSecs` sent by `/api/quiz/[quizId]`.
- **Fix**: When `att?.remainingDurationSecs` is present, set:
  ```typescript
  if (typeof att?.remainingDurationSecs === "number") {
    setTimeLeftSeconds(Math.max(0, att.remainingDurationSecs));
  }
  ```

### 5.2 Token Payload Key Mismatch in Start API
- **Observation**:
  - Client runner sends: `{ examToken: token }` (`src/app/student/quiz/[quizId]/page.tsx:271`).
  - Server start route expects: `body.token` (`src/app/api/quiz/[quizId]/start/route.ts:97`).
  - Result: `userToken` evaluates to `""`, failing token validation even when student typed the correct token.
- **Fix**: Update start route to accept `body.token || body.examToken`.

---

## 6. Verification and UI/UX Standard Compliance

1. **Mobile Responsiveness (< 640px)**:
   - Exam card grid uses `grid-cols-1 md:grid-cols-2`.
   - Waiting/Closed countdown screens must use `w-full max-w-lg mx-auto p-4 sm:p-6` with fluid font sizes (`text-xs sm:text-sm`).
   - Floating dock navigation uses `w-[94%] sm:w-auto max-w-xl` at bottom center.
2. **Custom Dialogs Standard (`useDialog`)**:
   - All confirmations (starting exam, submitting exam, violation warnings) strictly use `useDialog()` (`confirm`, `toast`). Native `alert()` / `confirm()` are not used anywhere.
3. **CBT Exambro Anti-Cheat**:
   - `enableCameraProctor` defaults to `false` for mobile usability.
   - Window blur, fullscreen exit, and tab switch trigger violation strikes consistently.

---

## 7. Implementation Recommendations for Implementer Agent

1. **Update `/api/student/exams/route.ts` & `/student/exams/page.tsx`**:
   - Update `ExamItem` interface with `openAt`, `closeAt`, `availability`.
   - Render countdown banners and disabled action buttons for upcoming/closed exams.
2. **Update `/api/quiz/[quizId]/route.ts`**:
   - Add gatekeeping check for `openAt` and `closeAt` for students without an active attempt.
   - Return `availability` and sanitized payload if upcoming/closed.
3. **Update `/api/quiz/[quizId]/start/route.ts`**:
   - Support `body.token || body.examToken`.
4. **Update `/student/quiz/[quizId]/page.tsx`**:
   - Fix timer reload initialization using `att.remainingDurationSecs`.
   - Add "Ujian Belum Dibuka" waiting screen with ticking countdown timer.
   - Add "Ujian Telah Ditutup" screen for expired exams.
   - Implement `syncProgress` background caller on answer changes with debouncing and sync status indicator.
