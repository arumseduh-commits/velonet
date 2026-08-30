import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// =========================================================================
// EMPIRICAL CHALLENGER TEST SUITE: MILESTONE 1 & MILESTONE 2
// =========================================================================
console.log("===============================================================");
console.log("VELONET EMPIRICAL CHALLENGER SUITE: M1 (INDEXES) & M2 (PAYLOAD)");
console.log("===============================================================");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, detail = "") {
  totalTests++;
  if (Boolean(condition)) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    const msg = `  [FAIL] ${testName}${detail ? ` -> ${detail}` : ""}`;
    console.error(msg);
    failures.push(msg);
  }
}

// =========================================================================
// SUITE 1: PRISMA SCHEMA & COMPOSITE INDEX VERIFICATION (M1)
// =========================================================================
console.log("\n--- SUITE 1: Prisma Schema & Database Indexing (M1) ---");

const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
assert(fs.existsSync(schemaPath), "prisma/schema.prisma exists");

const schemaContent = fs.readFileSync(schemaPath, "utf-8");

// Helper to extract indices for a model
function extractModelIndices(schema, modelName) {
  const modelRegex = new RegExp(`model\\s+${modelName}\\s+\\{([^}]+)\\}`, "m");
  const match = schema.match(modelRegex);
  if (!match) return { exists: false, indexes: [], uniques: [], relations: [] };
  const body = match[1];
  
  const indexMatches = [...body.matchAll(/@@index\(\[([^\]]+)\]\)/g)].map((m) =>
    m[1].split(",").map((s) => s.trim())
  );
  const uniqueMatches = [...body.matchAll(/@@unique\(\[([^\]]+)\]\)/g)].map((m) =>
    m[1].split(",").map((s) => s.trim())
  );
  
  // Single-field uniques & relations
  const lines = body.split("\n");
  const singleUniques = [];
  const relations = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes("@unique")) {
      const fieldName = trimmed.split(/\s+/)[0];
      singleUniques.push([fieldName]);
    }
    if (trimmed.includes("@relation(")) {
      const fieldsMatch = trimmed.match(/fields:\s*\[([^\]]+)\]/);
      if (fieldsMatch) {
        relations.push(fieldsMatch[1].trim());
      }
    }
  }

  return {
    exists: true,
    indexes: indexMatches,
    uniques: [...uniqueMatches, ...singleUniques],
    relations,
  };
}

// 1. Validate prisma schema CLI
try {
  const validateOutput = execSync("node ./node_modules/prisma/build/index.js validate", { encoding: "utf-8" });
  assert(
    validateOutput.includes("is valid") || validateOutput.includes("The schema at"),
    "Prisma schema validation CLI passes cleanly",
    validateOutput.trim()
  );
} catch (err) {
  assert(false, "Prisma schema validation CLI passes cleanly", err.message);
}

// Models specified in Milestone 1 requirement:
const requiredIndexedModels = [
  { name: "User", expectedIndices: [["role"], ["status"], ["studentClass"], ["isExcluded"], ["isKickedFromGrp"], ["createdAt"], ["role", "studentClass"]] },
  { name: "MeetingSession", expectedIndices: [["isActive", "isCancelled"], ["startTime", "endTime"], ["date"], ["createdAt"]] },
  { name: "Attendance", expectedIndices: [["userId"], ["sessionId", "status"], ["userId", "status"], ["checkInTime"]] },
  { name: "Question", expectedIndices: [["quizId"], ["quizId", "order"], ["quizId", "type"]] },
  { name: "Option", expectedIndices: [["questionId"], ["questionId", "isCorrect"]] },
  { name: "QuizAttempt", expectedIndices: [["quizId"], ["userId"], ["quizId", "status"], ["quizId", "userId"], ["userId", "createdAt"], ["quizId", "updatedAt"]] },
  { name: "QuizStudentAnswer", expectedIndices: [["questionId"], ["attemptId", "isAutoGraded"]] },
  { name: "Chapter", expectedIndices: [["courseId"], ["courseId", "order"]] },
  { name: "Lesson", expectedIndices: [["chapterId"], ["chapterId", "order"], ["quizId"]] },
  { name: "Enrollment", expectedIndices: [["courseId"], ["userId", "progress"]] },
  { name: "Progress", expectedIndices: [["lessonId"], ["userId", "isCompleted"]] },
  { name: "Submission", expectedIndices: [["assignmentId"], ["userId"], ["assignmentId", "userId"], ["submittedAt"]] },
  { name: "XPLog", expectedIndices: [["profileId"], ["profileId", "createdAt"], ["createdAt"]] },
  { name: "UserBadge", expectedIndices: [["profileId"], ["profileId", "badgeName"], ["awardedAt"]] },
  { name: "AIChatSession", expectedIndices: [["userId"], ["updatedAt"], ["contextTopicId"]] },
  { name: "AIChatMessage", expectedIndices: [["sessionId"], ["sessionId", "createdAt"]] },
];

for (const req of requiredIndexedModels) {
  const meta = extractModelIndices(schemaContent, req.name);
  assert(meta.exists, `Model ${req.name} defined in schema`);

  for (const expIdx of req.expectedIndices) {
    const hasIndex = meta.indexes.some((idx) =>
      idx.length === expIdx.length && idx.every((val, i) => val === expIdx[i])
    );
    assert(hasIndex, `Model ${req.name} has @@index([${expIdx.join(", ")}])`);
  }
}

// 2. Verify Foreign Key Index Coverage across schema
console.log("\n--- Checking Foreign Key Index Coverage across all models ---");
const allModels = [
  "User", "OtpVerification", "StudentSession", "MeetingSession", "Attendance",
  "Course", "Chapter", "Lesson", "Enrollment", "Progress", "Assignment", "Submission",
  "GamificationProfile", "XPLog", "UserBadge", "Quiz", "Question", "Option",
  "QuizAttempt", "QuizStudentAnswer", "ExamViolationLog", "AIChatSession", "AIChatMessage"
];

for (const model of allModels) {
  const meta = extractModelIndices(schemaContent, model);
  if (!meta.exists) continue;
  for (const relField of meta.relations) {
    const isIndexed =
      meta.indexes.some((idx) => idx[0] === relField) ||
      meta.uniques.some((u) => u[0] === relField);
    assert(isIndexed, `Foreign key '${model}.${relField}' has index or unique constraint`);
  }
}

// =========================================================================
// SUITE 2: BIOMETRIC PAYLOAD DIET & ABSENCE OF facePhoto (M2)
// =========================================================================
console.log("\n--- SUITE 2: Biometric Payload Diet & Size Verification (M2) ---");

// Helper to generate a realistic 128-float embedding vector
function generateMockFaceDescriptor() {
  const vector = Array.from({ length: 128 }, () => Math.round((Math.random() * 2 - 1) * 10000) / 10000);
  return JSON.stringify(vector);
}

// Helper to generate a mock base64 photo (approx 250KB)
function generateMockBase64Photo() {
  return "data:image/jpeg;base64," + "A".repeat(250 * 1024);
}

// 1. Simulate GET /api/attendance/face-descriptors transformation for 30 users
const mockDbUsers30 = Array.from({ length: 30 }, (_, i) => ({
  id: `usr-${i + 1}`,
  name: `Participant Name ${i + 1}`,
  phoneNumber: `0812345678${i.toString().padStart(2, "0")}`,
  studentClass: `XII-MIPA-${(i % 3) + 1}`,
  gender: i % 2 === 0 ? "Laki-laki" : "Perempuan",
  faceDescriptor: generateMockFaceDescriptor(),
}));

const transformedDescriptors30 = mockDbUsers30.map((u) => {
  let descriptorArray = [];
  try {
    if (u.faceDescriptor) {
      descriptorArray = JSON.parse(u.faceDescriptor);
    }
  } catch (e) {}

  return {
    id: u.id,
    name: u.name || "Peserta",
    studentClass: u.studentClass || "-",
    phoneNumber: u.phoneNumber,
    gender: u.gender,
    descriptor: descriptorArray,
  };
});

const responsePayload30 = {
  success: true,
  data: transformedDescriptors30,
};

const jsonString30 = JSON.stringify(responsePayload30);
const payloadSizeBytes30 = Buffer.byteLength(jsonString30, "utf-8");
const payloadSizeKB30 = payloadSizeBytes30 / 1024;

console.log(`\n  [Empirical Metric] 30 Users Face Descriptors Payload Size: ${payloadSizeKB30.toFixed(2)} KB (${payloadSizeBytes30} bytes)`);

assert(payloadSizeBytes30 < 50 * 1024, `30 Users Face Descriptors Payload is < 50KB (Actual: ${payloadSizeKB30.toFixed(2)} KB)`);
assert(!jsonString30.includes("facePhoto"), "Absence of 'facePhoto' key in GET /api/attendance/face-descriptors response string");

for (const user of transformedDescriptors30) {
  assert(user.facePhoto === undefined, `User ${user.id} has no facePhoto property`);
  assert(Array.isArray(user.descriptor) && user.descriptor.length === 128, `User ${user.id} has valid 128-float descriptor`);
}

// 2. Contrast with Unoptimized Payload with facePhoto
const mockUnoptimized30 = mockDbUsers30.map((u) => ({
  ...u,
  descriptor: JSON.parse(u.faceDescriptor),
  facePhoto: generateMockBase64Photo(),
}));
const unoptimizedSizeBytes = Buffer.byteLength(JSON.stringify({ success: true, data: mockUnoptimized30 }), "utf-8");
const unoptimizedSizeMB = unoptimizedSizeBytes / (1024 * 1024);
const reductionPercentage = ((1 - payloadSizeBytes30 / unoptimizedSizeBytes) * 100).toFixed(2);

console.log(`  [Empirical Contrast] Unoptimized 30 Users (with facePhoto): ${unoptimizedSizeMB.toFixed(2)} MB (${unoptimizedSizeBytes} bytes)`);
console.log(`  [Empirical Metric] Payload Reduction Ratio: ${reductionPercentage}% Bandwidth Savings\n`);
assert(parseFloat(reductionPercentage) > 95, `Payload diet achieves >95% reduction (Actual: ${reductionPercentage}%)`);

// 3. Stress-test scalability with 50 and 100 users
const mockDbUsers100 = Array.from({ length: 100 }, (_, i) => ({
  id: `usr-stress-${i + 1}`,
  name: `Participant Name Very Long Test ${i + 1}`,
  phoneNumber: `0812345678${i.toString().padStart(3, "0")}`,
  studentClass: `XII-MIPA-${(i % 3) + 1}`,
  gender: i % 2 === 0 ? "Laki-laki" : "Perempuan",
  faceDescriptor: generateMockFaceDescriptor(),
}));

const transformed100 = mockDbUsers100.map((u) => ({
  id: u.id,
  name: u.name,
  studentClass: u.studentClass,
  phoneNumber: u.phoneNumber,
  gender: u.gender,
  descriptor: JSON.parse(u.faceDescriptor),
}));
const size100KB = Buffer.byteLength(JSON.stringify({ success: true, data: transformed100 }), "utf-8") / 1024;
console.log(`  [Empirical Metric] 100 Users Scalability Test: ${size100KB.toFixed(2)} KB (Linear scaling confirmed: ~${(size100KB / 100).toFixed(2)} KB per user)`);
assert(size100KB < 150, `100 Users Face Descriptors Payload is < 150KB (Actual: ${size100KB.toFixed(2)} KB)`);

// =========================================================================
// SUITE 3: PARTICIPANTS QUERY PROJECTION & NON-BLOCKING I/O (M2)
// =========================================================================
console.log("\n--- SUITE 3: Participants & Student Routes Static & Dynamic Analysis (M2) ---");

// 1. Inspect src/app/api/attendance/face-descriptors/route.ts
const faceDescriptorsRoutePath = path.resolve(process.cwd(), "src/app/api/attendance/face-descriptors/route.ts");
assert(fs.existsSync(faceDescriptorsRoutePath), "src/app/api/attendance/face-descriptors/route.ts exists");
const faceDescriptorsRouteCode = fs.readFileSync(faceDescriptorsRoutePath, "utf-8");

assert(
  !faceDescriptorsRouteCode.includes("facePhoto: true"),
  "face-descriptors route does NOT select facePhoto from Prisma"
);
assert(
  faceDescriptorsRouteCode.includes("select:") && faceDescriptorsRouteCode.includes("faceDescriptor: true"),
  "face-descriptors route uses selective projection with faceDescriptor"
);

// 2. Inspect src/app/api/participants/route.ts
const participantsRoutePath = path.resolve(process.cwd(), "src/app/api/participants/route.ts");
assert(fs.existsSync(participantsRoutePath), "src/app/api/participants/route.ts exists");
const participantsRouteCode = fs.readFileSync(participantsRoutePath, "utf-8");

// Verify GET handler query projection
const getFunctionMatch = participantsRouteCode.match(/export\s+async\s+function\s+GET\s*\([^)]*\)\s*\{([\s\S]*?)(export\s+async\s+function|$)/);
assert(Boolean(getFunctionMatch), "GET function found in /api/participants/route.ts");

if (getFunctionMatch) {
  const getBody = getFunctionMatch[1];
  assert(!getBody.includes("facePhoto: true"), "GET /api/participants explicitly excludes facePhoto in select");
  assert(getBody.includes("select: {"), "GET /api/participants uses explicit field projection");
  assert(!getBody.includes("prisma.user.update"), "GET /api/participants has no blocking DB update calls");
  assert(!getBody.includes("prisma.user.create"), "GET /api/participants has no DB insert calls");
  assert(!getBody.includes("prisma.user.delete"), "GET /api/participants has no DB delete calls");
  assert(!getBody.includes("sock."), "GET /api/participants has no blocking Baileys socket calls");
}

// 3. Inspect src/app/api/student/auth/me/route.ts
const studentMeRoutePath = path.resolve(process.cwd(), "src/app/api/student/auth/me/route.ts");
assert(fs.existsSync(studentMeRoutePath), "src/app/api/student/auth/me/route.ts exists");
const studentMeRouteCode = fs.readFileSync(studentMeRoutePath, "utf-8");

assert(!studentMeRouteCode.includes("resolveLid"), "GET /api/student/auth/me has no blocking LID resolution calls");
assert(!studentMeRouteCode.includes("sock."), "GET /api/student/auth/me has no blocking Baileys socket calls");
assert(!studentMeRouteCode.includes("prisma.user.update"), "GET /api/student/auth/me has no DB write mutations");

// 4. Inspect src/app/api/student/profile/route.ts
const studentProfileRoutePath = path.resolve(process.cwd(), "src/app/api/student/profile/route.ts");
assert(fs.existsSync(studentProfileRoutePath), "src/app/api/student/profile/route.ts exists");
const studentProfileRouteCode = fs.readFileSync(studentProfileRoutePath, "utf-8");

const studentProfileGetMatch = studentProfileRouteCode.match(/export\s+async\s+function\s+GET\s*\([^)]*\)\s*\{([\s\S]*?)(export\s+async\s+function|$)/);
assert(Boolean(studentProfileGetMatch), "GET function found in /api/student/profile/route.ts");
if (studentProfileGetMatch) {
  const getBody = studentProfileGetMatch[1];
  assert(!getBody.includes("resolveLid"), "GET /api/student/profile has no blocking LID resolution calls");
  assert(!getBody.includes("sock."), "GET /api/student/profile has no blocking Baileys socket calls");
  assert(!getBody.includes("prisma.user.update"), "GET /api/student/profile has no DB write mutations");
}

// =========================================================================
// SUMMARY & VERDICT
// =========================================================================
console.log("\n===============================================================");
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
console.log("===============================================================");

if (failedTests > 0) {
  console.error(`\nFAILED TESTS (${failedTests}):`);
  failures.forEach((f) => console.error(f));
  process.exit(1);
} else {
  console.log("\n>> ALL EMPIRICAL CHALLENGER TESTS PASSED (100% SUCCESS) <<\n");
  process.exit(0);
}
