# Usulan Skema Database untuk LMS Overpower

File ini berisi usulan penambahan dan modifikasi untuk file `prisma/schema.prisma` Anda saat ini guna mendukung fitur-fitur LMS yang baru.

## 1. Manajemen Pengguna & Peran
Saat ini, Anda menggunakan model `Participant`. Kita perlu menambahkan Peran (Role) dan autentikasi untuk Mentor/Admin.

```prisma
enum Role {
  STUDENT
  MENTOR
  ADMIN
}

// Modifikasi Participant yang sudah ada atau buat model User gabungan
model User {
  id              String    @id @default(uuid())
  phoneNumber     String    @unique
  name            String?
  role            Role      @default(STUDENT)
  
  // Field yang sudah ada dari Participant
  studentClass    String?
  motivation      String?
  hobby           String?
  gender          String?
  status          String    @default("NOT_STARTED")
  isExcluded      Boolean   @default(false)
  
  // Relasi LMS
  enrollments     Enrollment[]
  submissions     Submission[]
  quizAttempts    QuizAttempt[]
  gamification    GamificationProfile?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

## 2. Struktur Kursus (Course)
```prisma
model Course {
  id          String    @id @default(uuid())
  title       String
  slug        String    @unique
  description String?
  thumbnail   String?
  isPublished Boolean   @default(false)
  
  chapters    Chapter[]
  enrollments Enrollment[]
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Chapter {
  id          String    @id @default(uuid())
  courseId    String
  course      Course    @relation(fields: [courseId], references: [id], onDelete: Cascade)
  title       String
  order       Int
  
  lessons     Lesson[]
}

enum LessonType {
  VIDEO
  TEXT
  QUIZ
  ASSIGNMENT
}

model Lesson {
  id          String    @id @default(uuid())
  chapterId   String
  chapter     Chapter   @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  title       String
  type        LessonType
  content     String?   // HTML/Markdown untuk teks, URL Video untuk tipe VIDEO
  order       Int
  
  // Untuk Kuis dan Tugas
  quizId      String?
  assignment  Assignment?
  
  progress    Progress[]
}
```

## 3. Progres & Pengumpulan Tugas
```prisma
model Enrollment {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  progress  Int      @default(0) // Persentase 0-100
  
  @@unique([userId, courseId])
}

model Progress {
  id        String   @id @default(uuid())
  userId    String
  lessonId  String
  lesson    Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  isCompleted Boolean @default(false)
  completedAt DateTime?
  
  @@unique([userId, lessonId])
}

model Assignment {
  id          String   @id @default(uuid())
  lessonId    String   @unique
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  description String
  maxScore    Int      @default(100)
  deadline    DateTime?
  
  submissions Submission[]
}

model Submission {
  id           String     @id @default(uuid())
  assignmentId String
  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  contentUrl   String?    // Link ke file upload atau repo GitHub
  textResponse String?
  score        Int?
  feedback     String?
  submittedAt  DateTime   @default(now())
  gradedAt     DateTime?
}
```

## 4. Gamifikasi (Fitur "Overpower")
```prisma
model GamificationProfile {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  xp        Int      @default(0)
  level     Int      @default(1)
  streak    Int      @default(0)
  lastLogin DateTime?
  
  userBadges UserBadge[]
  xpLogs     XPLog[]
}

model XPLog {
  id          String   @id @default(uuid())
  profileId   String
  profile     GamificationProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  amount      Int
  reason      String   // contoh: "Menyelesaikan Pelajaran 1", "Kehadiran Sempurna"
  createdAt   DateTime @default(now())
}

model UserBadge {
  id        String   @id @default(uuid())
  profileId String
  profile   GamificationProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  badgeName String
  iconUrl   String?
  awardedAt DateTime @default(now())
}
```
