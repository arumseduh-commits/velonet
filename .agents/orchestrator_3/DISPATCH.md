## 2026-08-30T16:00:22Z

User Request:
Lakukan audit menyeluruh dan optimasi arsitektur database indexing Prisma, eliminasi transmisi payload berat data biometrik, serta refactor query batching CBT dan sinkronisasi bot pada aplikasi VeloNet.

Requirements Summary:
1. R1. Comprehensive Database Indexing: Add composite indices (@@index) and foreign key indices in prisma/schema.prisma for all relation models and main filter/sort columns (User, MeetingSession, Attendance, Question, Option, QuizAttempt, QuizStudentAnswer, Chapter, Lesson, Enrollment, Progress, Submission, XPLog, UserBadge, AIChatSession, AIChatMessage). Run prisma generate / db push.
2. R2. Payload Diet & Elimination of Blocking I/O: Exclude heavy base64 facePhoto from participant list query (/api/participants) and face descriptor endpoint (/api/attendance/face-descriptors). Remove blocking LID resolving from critical GET request paths.
3. R3. Batching & Transaction Optimization: Refactor sequential N+1 query loops in CBT quiz submission (/api/quiz/submit) and bot group member synchronization (fetchGroupMembersWithStatus in bot-engine.ts) to single batch queries (findMany with in operator) and parallel/transaction execution (Promise.all / prisma.$transaction).
4. R4. Code Integrity & Build Verification: Ensure custom UI dialogs (useDialog), mobile responsiveness (<640px), Next.js build verification (npm run build) passes with 0 errors, and git commit/push to origin main.
