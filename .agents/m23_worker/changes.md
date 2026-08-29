# Changes Report: Milestones 2 & 3

## Summary of Changes

### 1. Milestone 2 - Student Fast Progress Sync
- **src/app/api/quiz/[quizId]/progress/route.ts**:
  - Enhanced API to handle both single question answer { questionId, answer } and full answers map { answers }.
  - Recalculates live auto-gradable score accurately (SINGLE_CHOICE, TRUE_FALSE, CHECKBOXES, SHORT_ANSWER).
  - Upserts individual QuizStudentAnswer records in the database with selectedOptionIds, 	extResponse, isAutoGraded, and earnedPoints.
  - Updates QuizAttempt.answers JSON and QuizAttempt.score.
  - Returns { success: true, answeredCount, totalQuestions, currentScore, data: { answeredCount, totalQuestions, currentScore, liveScore } }.

- **src/app/student/quiz/[quizId]/page.tsx**:
  - Implemented cloudSyncStatus state ('SAVED' | 'SAVING' | 'OFFLINE').
  - Added non-blocking background synchronization helper syncProgressToServer.
  - Connected answer handlers (handleSelectOption, handleToggleMultipleOption, handleTextResponseChange):
    - Optimistic React state update & immediate localStorage draft write.
    - Immediate background sync for MCQ/TF and Checkboxes.
    - Debounced background sync (700ms) for Short Answer and Essay text inputs.
  - Added sleek, responsive Cloud Sync Status indicator in the runner header with clear visual state badges (Menyimpan..., Tersimpan di Cloud, Offline).

### 2. Milestone 3 - Realtime Live Proctor & Gamified Leaderboard ala Quizizz
- **src/app/api/admin/exams/[quizId]/proctor/route.ts**:
  - Enhanced query to include ordered questions (order: 'asc').
  - Calculated nsweredQuestionIds set for each attempt (supporting both JSON map and QuizStudentAnswer rows).
  - Included participants alongside ttempts with complete metadata (studentId, studentName, studentClass, phoneNumber, status, strikes, score, 	otalScore, nsweredCount, 	otalQuestions, progressPercentage, nsweredQuestionIds, lastPing, iolations).
  - Realtime statistics breakdown (inProgress, locked, submitted, disqualified).

- **src/app/admin/exams/[quizId]/proctor/page.tsx**:
  - Upgraded to 3-second realtime polling interval with isFetchingRef concurrency lock to eliminate duplicate overlapping network requests.
  - **Dynamic Rank Shift Tracking**: Implemented prevRanksRef comparison across polling cycles to render dynamic rank shift badges (↑, ↓, =).
  - **Top 3 Gamified Live Podium ala Quizizz**:
    - #1 Gold (center, tallest podium, crown animation, glowing amber border, flame score points pill).
    - #2 Silver (left, medium podium, silver medal).
    - #3 Bronze (right, lower podium, bronze medal).
    - Student avatar initials, name, class, score points, and rank delta shifts.
  - **Live Participant Table / Cards**:
    - Dynamic rank badge + rank shift indicator.
    - Status badges (Mengerjakan with live pulse, Terkunci with alert pulse, Selesai with checkmark, Didiskualifikasi).
    - Progress bar (% answered) + per-question visual dot matrix (Green = answered, Slate = unanswered).
    - Realtime score display (score / totalScore Poin).
    - Strike indicator badges (0/3 Green/Slate, 1-2/3 Amber warning, 3/3 Red danger).
    - Quick supervisor action buttons:
      - Buka Kunci (Unlock): ction: 'UNLOCK'.
      - Reset Pelanggaran (Reset Strikes): ction: 'RESET_STRIKES'.
      - Kumpulkan Paksa (Force Submit): ction: 'FORCE_SUBMIT'.
      - Diskualifikasi (Kick / Disqualify): ction: 'DISQUALIFY'.
      - 100% wired with custom useDialog().confirm and custom toasts — strictly zero native browser lert() or confirm().
  - **Filters, Search & Sort**:
    - Class Filter dropdown (All Classes + dynamic class list).
    - Status filter tabs (Semua, Mengerjakan, Terkunci, Selesai, Didiskualifikasi).
    - Sort dropdown (Skor Tertinggi 🏆, Progress Tercepat 📑, Pelanggaran Terbanyak ⚠️, Nama Siswa A-Z 🔤).
    - Search input for student name, NIS, class, phone number.
  - **Mobile Responsiveness (< 640px)**:
    - Flexible wrapping with lex-col sm:flex-row.
    - Minimum 40px touch targets on all interactive elements.
    - Responsive podium heights and font scaling for smartphones.

### 3. Verification & Testing
- 
pm run build: Passed with 0 TypeScript and Next.js build errors.
- scripts/test-m1-scheduling.ts: 57 out of 57 integration tests passed (100% pass rate).
