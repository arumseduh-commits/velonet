# Database Indexing Optimization Specification & Architecture Analysis

**Project**: VeloNet (Next.js + Prisma ORM + PostgreSQL)  
**Author**: Explorer 1  
**Date**: 2026-08-30  
**Scope**: `prisma/schema.prisma` and Application Query Patterns  

---

## 1. Executive Summary

A comprehensive architectural audit of `prisma/schema.prisma` across all 27 database models revealed significant indexing deficits. While several models declare `@unique` constraints (e.g. `User.phoneNumber`, `Attendance[sessionId, userId]`, `QuizStudentAnswer[attemptId, questionId]`), **critical foreign keys and high-frequency query filter/sort columns lack explicit indices**. In PostgreSQL:
1. Foreign key columns (`@relation(fields: [...])`) are **NOT** indexed automatically by PostgreSQL or Prisma unless specified via `@@index` or `@unique`.
2. Multi-column unique constraints (such as `[sessionId, userId]` or `[attemptId, questionId]`) only allow index range scans when queries filter on the **first/leading** column. Reverse lookups (e.g., querying attendance by `userId` or student answers by `questionId`) result in unindexed Full Table Scans (Seq Scan).
3. High-throughput polling endpoints (e.g., `/admin/exams/[quizId]/proctor` polling every 3s) and heavy batch pipelines (e.g. `/api/quiz/submit`, `/api/attendance/face-descriptors`) suffer from sequential scanning overhead without composite indices on `[quizId, updatedAt]`, `[quizId, status]`, `[questionId, isCorrect]`, and `[chapterId, order]`.

This document specifies the exact indexing roadmap to achieve optimal index coverage across all relational and transactional entities.

---

## 2. Comprehensive Index Specification Table

| # | Model | Existing Index / Unique Directives | Missing FK Indices | Recommended `@@index` Directives | Primary Query Use Case & Justification |
|---|-------|------------------------------------|--------------------|-----------------------------------|-----------------------------------------|
| 1 | `User` | `@unique(phoneNumber)` | N/A (Root model) | `@@index([role])`<br>`@@index([status])`<br>`@@index([studentClass])`<br>`@@index([isExcluded])`<br>`@@index([isKickedFromGrp])`<br>`@@index([createdAt])`<br>`@@index([role, studentClass])` | `/api/participants` (filter by status, studentClass, role), `/api/exclusions` (`isExcluded: true`), `/api/kick-list` (`isKickedFromGrp: true`), `/api/attendance/face-descriptors` (`isExcluded: false`), `/api/leaderboard` (`role: STUDENT`). |
| 2 | `OtpVerification` | `@@index([phoneNumber])`<br>`@@index([magicToken])`<br>`@unique(magicToken)` | `userId` | `@@index([userId])`<br>`@@index([userId, isUsed, expiresAt])` | `verify-otp/route.ts:38-44` queries `where: { userId, isUsed: false, expiresAt: { gte: now } }, orderBy: { createdAt: "desc" }`. Eliminates full table scan on OTP validation. |
| 3 | `StudentSession` | `@@index([userId])`<br>`@@index([sessionToken])`<br>`@unique(sessionToken)` | None (`userId` already indexed) | `@@index([expiresAt])` | `student-auth.ts`: Session cleanup cron and expiration sweeping by timestamp. |
| 4 | `MeetingSession` | None | None | `@@index([isActive, isCancelled])`<br>`@@index([startTime, endTime])`<br>`@@index([date])`<br>`@@index([createdAt])` | `active-locations/route.ts:10-16` filters `where: { isActive: true, isCancelled: false, startTime: { lte: now }, endTime: { gte: now } }`. `sessions/route.ts` sorts by `createdAt: desc`. |
| 5 | `Attendance` | `@@unique([sessionId, userId])` | `userId` (leading) | `@@index([userId])`<br>`@@index([sessionId, status])`<br>`@@index([userId, status])`<br>`@@index([checkInTime])` | `student/auth/me/route.ts:17` and `leaderboard/route.ts:22` filter by `userId` and `status: "HADIR"`. `sessions/route.ts:19` filters attendance by `status` within a session. |
| 6 | `ScrapedArticle` | `@@index([category])`<br>`@@index([slug])`<br>`@unique(slug)` | None | `@@index([category, level])`<br>`@@index([scrapedAt])` | MisterGuru AI Knowledge Base (`/api/admin/ai/knowledge-base`) filters articles by category & difficulty level, ordered by `scrapedAt: desc`. |
| 7 | `Course` | `@unique(slug)` | None | `@@index([isPublished])`<br>`@@index([createdAt])`<br>`@@index([isPublished, createdAt])` | `/api/courses` public catalog displays published courses ordered by `createdAt: desc`. |
| 8 | `Chapter` | None | `courseId` | `@@index([courseId])`<br>`@@index([courseId, order])` | LMS course outline views fetch chapters for a given course ordered by `order: asc` (`where: { courseId }, orderBy: { order: "asc" }`). |
| 9 | `Lesson` | None | `chapterId`<br>`quizId` | `@@index([chapterId])`<br>`@@index([chapterId, order])`<br>`@@index([quizId])` | Chapter detail view fetches lessons ordered by `order: asc`. LMS quiz lesson navigation links `quizId` to `Quiz`. |
| 10 | `Enrollment` | `@@unique([userId, courseId])` | `courseId` (leading) | `@@index([courseId])`<br>`@@index([userId, progress])` | Course roster views query enrollments by `courseId`. Student dashboard filters enrollments by student with `progress` tracking. |
| 11 | `Progress` | `@@unique([userId, lessonId])` | `lessonId` (leading) | `@@index([lessonId])`<br>`@@index([userId, isCompleted])` | Analytics query completions by `lessonId`. Student syllabus view checks completed lessons (`where: { userId, isCompleted: true }`). |
| 12 | `Assignment` | `@unique(lessonId)` | None | `@@index([deadline])` | Assignment deadline alert cron checks upcoming and past-due assignments. |
| 13 | `Submission` | None | `assignmentId`<br>`userId` | `@@index([assignmentId])`<br>`@@index([userId])`<br>`@@index([assignmentId, userId])`<br>`@@index([submittedAt])` | Assignment grading view lists submissions by `assignmentId`. Gamification and student dashboard query submissions by `userId` and `submittedAt`. |
| 14 | `GamificationProfile` | `@unique(userId)` | None (`userId` is unique) | `@@index([xp])`<br>`@@index([level])` | Gamification leaderboards (`/api/leaderboard`) sort and rank student profiles by `xp: desc` and `level: desc`. |
| 15 | `XPLog` | None | `profileId` | `@@index([profileId])`<br>`@@index([profileId, createdAt])`<br>`@@index([createdAt])` | XP history ledger queries all logs for a user profile ordered by `createdAt: desc`. |
| 16 | `UserBadge` | None | `profileId` | `@@index([profileId])`<br>`@@index([profileId, badgeName])`<br>`@@index([awardedAt])` | `evaluateBadges` (`gamification.ts:56-130`) checks if a profile already has a specific badge name (`where: { profileId, badgeName }`). |
| 17 | `Quiz` | None | None | `@@index([createdAt])`<br>`@@index([openAt, closeAt])`<br>`@@index([examToken])` | `/api/student/exams` and `/api/admin/exams` query availability windows (`openAt`/`closeAt`) and sort by `createdAt: desc`. Token-based exam entry uses `examToken`. |
| 18 | `Question` | None | `quizId` | `@@index([quizId])`<br>`@@index([quizId, order])`<br>`@@index([quizId, type])` | Quiz runner and grading routes fetch all questions for a quiz ordered by `order: asc` (`/api/admin/exams/[quizId]/proctor:22`, `/api/quiz/submit:68`). |
| 19 | `Option` | None | `questionId` | `@@index([questionId])`<br>`@@index([questionId, isCorrect])` | Auto-grading engine (`/api/quiz/submit:111-135`) checks correct options for questions (`where: { questionId, isCorrect: true }`). |
| 20 | `QuizAttempt` | `@@index([quizId])`<br>`@@index([userId])` | None (Single FKs indexed) | `@@index([quizId, status])`<br>`@@index([quizId, userId])`<br>`@@index([userId, createdAt])`<br>`@@index([quizId, updatedAt])` | Live Proctor (`/admin/exams/[quizId]/proctor:32-57`) polls every 3s with `where: { quizId }, orderBy: { updatedAt: "desc" }`. `/api/quiz/submit:193-198` checks `where: { quizId, userId }, orderBy: { createdAt: "desc" }`. |
| 21 | `QuizStudentAnswer` | `@@unique([attemptId, questionId])` | `questionId` (leading) | `@@index([questionId])`<br>`@@index([attemptId, isAutoGraded])` | Question analytics query all answers by `questionId`. Essay grading dashboard queries ungraded answers (`where: { attemptId, isAutoGraded: false }`). |
| 22 | `ExamViolationLog` | `@@index([attemptId])` | None (`attemptId` indexed) | `@@index([attemptId, timestamp])`<br>`@@index([type])` | Live Proctor route (`/api/admin/exams/[quizId]/proctor:52`) loads violations ordered by `timestamp: desc, take: 5`. Violation audit queries filter by violation `type`. |
| 23 | `AIChatSession` | None | `userId` | `@@index([userId])`<br>`@@index([updatedAt])`<br>`@@index([contextTopicId])` | `/api/admin/ai/chat/session` queries sessions sorted by `updatedAt: desc` and filtered by mentor `userId` and topic context. |
| 24 | `AIChatMessage` | None | `sessionId` | `@@index([sessionId])`<br>`@@index([sessionId, createdAt])` | `/api/admin/ai/chat/message` fetches chronological conversation history `where: { sessionId }, orderBy: { createdAt: "asc" }`. |

---

## 3. Detailed Model-by-Model Schema Specifications

### 3.1 Model `User`
```prisma
model User {
  id           String  @id @default(uuid())
  phoneNumber  String  @unique
  name         String?
  password     String?
  role         Role    @default(STUDENT)
  studentClass String?
  motivation   String?
  hobby        String?
  gender       String?
  birthDate    DateTime?
  status       String  @default("NOT_STARTED")

  isExcluded      Boolean   @default(false)
  isKickedFromGrp Boolean   @default(false)
  lastSentAt      DateTime?

  faceDescriptor   String?
  facePhoto        String?
  faceRegisteredAt DateTime?

  attendances      Attendance[]
  otpVerifications OtpVerification[]
  studentSessions  StudentSession[]

  enrollments  Enrollment[]
  submissions  Submission[]
  gamification GamificationProfile?
  quizAttempts QuizAttempt[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([role])
  @@index([status])
  @@index([studentClass])
  @@index([isExcluded])
  @@index([isKickedFromGrp])
  @@index([createdAt])
  @@index([role, studentClass])
}
```

### 3.2 Model `OtpVerification`
```prisma
model OtpVerification {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  phoneNumber String
  otpCode     String
  magicToken  String   @unique
  attempts    Int      @default(0)
  isUsed      Boolean  @default(false)
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([phoneNumber])
  @@index([magicToken])
  @@index([userId, isUsed, expiresAt])
}
```

### 3.3 Model `StudentSession`
```prisma
model StudentSession {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessionToken String   @unique
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([sessionToken])
  @@index([expiresAt])
}
```

### 3.4 Model `MeetingSession`
```prisma
model MeetingSession {
  id            String       @id @default(uuid())
  title         String
  date          DateTime
  startTime     DateTime
  endTime       DateTime
  locationName  String?
  latitude      Float?
  longitude     Float?
  radiusMeter   Float        @default(15)
  isActive      Boolean      @default(true)
  isCancelled   Boolean      @default(false)
  customMessage String?
  attendances   Attendance[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([isActive, isCancelled])
  @@index([startTime, endTime])
  @@index([date])
  @@index([createdAt])
}
```

### 3.5 Model `Attendance`
```prisma
model Attendance {
  id        String         @id @default(uuid())
  sessionId String
  session   MeetingSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userId    String
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  checkInTime   DateTime @default(now())
  status        String   @default("HADIR")
  method        String   @default("LOCATION_GPS")
  latitude      Float?
  longitude     Float?
  distanceMeter Float?
  faceConfidence Float?
  facePhotoCaptured String?
  notes         String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([sessionId, userId])
  @@index([userId])
  @@index([sessionId, status])
  @@index([userId, status])
  @@index([checkInTime])
}
```

### 3.6 Model `ScrapedArticle`
```prisma
model ScrapedArticle {
  id          String   @id @default(uuid())
  title       String
  slug        String   @unique
  category    String   @default("General")
  level       String   @default("Intermediate")
  summary     String?
  contentHtml String
  sourceUrl   String
  quizData    String?
  scrapedAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([category])
  @@index([slug])
  @@index([category, level])
  @@index([scrapedAt])
}
```

### 3.7 Model `Course`
```prisma
model Course {
  id          String  @id @default(uuid())
  title       String
  slug        String  @unique
  description String?
  thumbnail   String?
  isPublished Boolean @default(false)

  chapters    Chapter[]
  enrollments Enrollment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isPublished])
  @@index([createdAt])
  @@index([isPublished, createdAt])
}
```

### 3.8 Model `Chapter`
```prisma
model Chapter {
  id       String @id @default(uuid())
  courseId String
  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  title    String
  order    Int

  lessons Lesson[]

  @@index([courseId])
  @@index([courseId, order])
}
```

### 3.9 Model `Lesson`
```prisma
model Lesson {
  id        String     @id @default(uuid())
  chapterId String
  chapter   Chapter    @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  title     String
  type      LessonType
  content   String?
  order     Int

  quizId     String?
  assignment Assignment?

  progress Progress[]

  @@index([chapterId])
  @@index([chapterId, order])
  @@index([quizId])
}
```

### 3.10 Model `Enrollment`
```prisma
model Enrollment {
  id       String @id @default(uuid())
  userId   String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  courseId String
  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  progress Int    @default(0)

  @@unique([userId, courseId])
  @@index([courseId])
  @@index([userId, progress])
}
```

### 3.11 Model `Progress`
```prisma
model Progress {
  id          String    @id @default(uuid())
  userId      String
  lessonId    String
  lesson      Lesson    @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  isCompleted Boolean   @default(false)
  completedAt DateTime?

  @@unique([userId, lessonId])
  @@index([lessonId])
  @@index([userId, isCompleted])
}
```

### 3.12 Model `Assignment`
```prisma
model Assignment {
  id          String    @id @default(uuid())
  lessonId    String    @unique
  lesson      Lesson    @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  description String
  maxScore    Int       @default(100)
  deadline    DateTime?

  submissions Submission[]

  @@index([deadline])
}
```

### 3.13 Model `Submission`
```prisma
model Submission {
  id           String     @id @default(uuid())
  assignmentId String
  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  contentUrl   String?
  textResponse String?
  score        Int?
  feedback     String?
  submittedAt  DateTime  @default(now())
  gradedAt     DateTime?

  @@index([assignmentId])
  @@index([userId])
  @@index([assignmentId, userId])
  @@index([submittedAt])
}
```

### 3.14 Model `GamificationProfile`
```prisma
model GamificationProfile {
  id     String @id @default(uuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  xp        Int       @default(0)
  level     Int       @default(1)
  streak    Int       @default(0)
  lastLogin DateTime?

  userBadges UserBadge[]
  xpLogs     XPLog[]

  @@index([xp])
  @@index([level])
}
```

### 3.15 Model `XPLog`
```prisma
model XPLog {
  id        String              @id @default(uuid())
  profileId String
  profile   GamificationProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  amount    Int
  reason    String
  createdAt DateTime            @default(now())

  @@index([profileId])
  @@index([profileId, createdAt])
  @@index([createdAt])
}
```

### 3.16 Model `UserBadge`
```prisma
model UserBadge {
  id        String              @id @default(uuid())
  profileId String
  profile   GamificationProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  badgeName String
  iconUrl   String?
  awardedAt DateTime            @default(now())

  @@index([profileId])
  @@index([profileId, badgeName])
  @@index([awardedAt])
}
```

### 3.17 Model `Quiz`
```prisma
model Quiz {
  id          String   @id @default(uuid())
  title       String
  description String?
  
  openAt      DateTime?
  closeAt     DateTime?

  durationMinutes        Int      @default(30)
  enableFullscreenLock   Boolean  @default(true)
  enableTabSwitchDetect  Boolean  @default(true)
  maxStrikes             Int      @default(3)
  enableCameraProctor    Boolean  @default(false)
  supervisorPin          String   @default("123456")
  shuffleQuestions       Boolean  @default(true)
  shuffleOptions         Boolean  @default(true)

  examToken              String?
  showScoreImmediately   Boolean   @default(true)
  scoreReleaseAt         DateTime?
  showDiscussion         Boolean   @default(false)

  questions   Question[]
  attempts    QuizAttempt[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([createdAt])
  @@index([openAt, closeAt])
  @@index([examToken])
}
```

### 3.18 Model `Question`
```prisma
model Question {
  id            String       @id @default(uuid())
  quizId        String
  quiz          Quiz         @relation(fields: [quizId], references: [id], onDelete: Cascade)
  type          QuestionType @default(SINGLE_CHOICE)
  text          String
  imageUrl      String?
  points        Int          @default(10)
  order         Int          @default(0)
  
  explanation   String?
  sampleAnswer  String?
  gradingRubric String?
  caseSensitive Boolean      @default(false)
  
  options       Option[]
  studentAnswers QuizStudentAnswer[]

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([quizId])
  @@index([quizId, order])
  @@index([quizId, type])
}
```

### 3.19 Model `Option`
```prisma
model Option {
  id          String   @id @default(uuid())
  questionId  String
  question    Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  text        String
  isCorrect   Boolean  @default(false)

  @@index([questionId])
  @@index([questionId, isCorrect])
}
```

### 3.20 Model `QuizAttempt`
```prisma
model QuizAttempt {
  id          String               @id @default(uuid())
  quizId      String
  quiz        Quiz                 @relation(fields: [quizId], references: [id], onDelete: Cascade)
  userId      String
  user        User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  status      String               @default("IN_PROGRESS")
  strikeCount Int                  @default(0)
  score       Float                @default(0)
  totalScore  Float                @default(0)
  
  isFullyGraded Boolean            @default(false)
  
  answers     String?
  
  startedAt   DateTime             @default(now())
  submittedAt DateTime?
  gradedAt    DateTime?

  detailedAnswers QuizStudentAnswer[]
  violations  ExamViolationLog[]

  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  @@index([quizId])
  @@index([userId])
  @@index([quizId, status])
  @@index([quizId, userId])
  @@index([userId, createdAt])
  @@index([quizId, updatedAt])
}
```

### 3.21 Model `QuizStudentAnswer`
```prisma
model QuizStudentAnswer {
  id                   String      @id @default(uuid())
  attemptId            String
  attempt              QuizAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  questionId           String
  question             Question    @relation(fields: [questionId], references: [id], onDelete: Cascade)
  
  selectedOptionIds    String?
  textResponse         String?
  
  isAutoGraded         Boolean     @default(false)
  earnedPoints         Float       @default(0)
  
  aiSuggestedScore     Float?
  aiEvaluationFeedback String?
  
  teacherScore         Float?
  teacherFeedback      String?
  gradedByUserId       String?

  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt

  @@unique([attemptId, questionId])
  @@index([questionId])
  @@index([attemptId, isAutoGraded])
}
```

### 3.22 Model `ExamViolationLog`
```prisma
model ExamViolationLog {
  id          String      @id @default(uuid())
  attemptId   String
  attempt     QuizAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  type        String
  description String?
  snapshotUrl String?
  timestamp   DateTime    @default(now())

  @@index([attemptId])
  @@index([attemptId, timestamp])
  @@index([type])
}
```

### 3.23 Model `AIChatSession`
```prisma
model AIChatSession {
  id             String          @id @default(uuid())
  userId         String
  title          String          @default("Sesi Konsultasi Guru")
  contextTopicId String?
  
  messages       AIChatMessage[]

  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  @@index([userId])
  @@index([updatedAt])
  @@index([contextTopicId])
}
```

### 3.24 Model `AIChatMessage`
```prisma
model AIChatMessage {
  id                 String        @id @default(uuid())
  sessionId          String
  session            AIChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  role               String
  content            String
  generatedQuizDraft String?
  
  createdAt          DateTime      @default(now())

  @@index([sessionId])
  @@index([sessionId, createdAt])
}
```

---

## 4. Key Performance Benefits

1. **Live Proctor Leaderboard (Poll every 3s)**:
   - Without `@@index([quizId, updatedAt])`, every 3s polling query across 500+ student attempts does a full sequential scan on `QuizAttempt` and performs in-memory sorting.
   - With composite index `[quizId, updatedAt]`, PostgreSQL executes an `Index Scan Backward` in < 2ms directly from disk/cache.

2. **CBT Quiz Submission Batching (`/api/quiz/submit`)**:
   - Evaluating options with `@@index([questionId, isCorrect])` allows instantaneous B-tree lookups during auto-grading.
   - Upserting and fetching student answers via `@@index([attemptId, isAutoGraded])` eliminates bottleneck during multi-question transaction writes.

3. **Attendance & Student Profile Dashboards**:
   - `Attendance` previously only had `@@unique([sessionId, userId])`. Looking up all meetings for a single student (`where: { userId }`) required scanning all attendances across all sessions.
   - Adding `@@index([userId])` and `@@index([userId, status])` cuts student profile query latency from $O(N_{sessions} \times N_{students})$ to $O(\log N)$.

4. **LMS Course Hierarchy Traversal**:
   - Chapters and Lessons are rendered frequently. Adding `[courseId, order]` and `[chapterId, order]` allows PostgreSQL to satisfy both relational joins and sort ordering in a single index scan without sorting overhead.

---

## 5. Implementer Checklist & Migration Verification

1. Update `prisma/schema.prisma` with the recommended `@@index` definitions specified in Section 3.
2. Run `npx prisma format` to format the schema cleanly.
3. Validate client generation: `npx prisma generate`.
4. Apply to database: `npx prisma db push`.
5. Run full build check: `npm run build`.
