import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, detail) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    const msg = `  [FAIL] ${testName}${detail ? ` -> ${detail}` : ""}`;
    console.error(msg);
    failures.push(msg);
  }
}

// -------------------------------------------------------------
// SUITE 1: CBT Quiz Submission Atomic Transaction & Parallel Upserts
// -------------------------------------------------------------
async function runCbtSubmissionTransactionTest() {
  console.log("\n=======================================================");
  console.log("SUITE 1: CBT Quiz Submission Atomic Transaction & Batching");
  console.log("=======================================================");

  const testSuffix = Date.now();
  const testUser = await prisma.user.create({
    data: {
      name: `[TEST_M3] CBT Student ${testSuffix}`,
      phoneNumber: `628999${testSuffix}`,
      role: "STUDENT",
      studentClass: "12-M3",
    },
  });

  const testQuiz = await prisma.quiz.create({
    data: {
      title: `[TEST_M3] Exam Batch Submission ${testSuffix}`,
      durationMinutes: 45,
      questions: {
        create: [
          {
            order: 1,
            type: "SINGLE_CHOICE",
            text: "What is 2 + 2?",
            points: 25,
            options: {
              create: [
                { text: "4", isCorrect: true },
                { text: "5", isCorrect: false },
              ],
            },
          },
          {
            order: 2,
            type: "CHECKBOXES",
            text: "Select even numbers",
            points: 25,
            options: {
              create: [
                { text: "2", isCorrect: true },
                { text: "4", isCorrect: true },
                { text: "5", isCorrect: false },
              ],
            },
          },
          {
            order: 3,
            type: "SHORT_ANSWER",
            text: "Capital of Indonesia?",
            points: 25,
            sampleAnswer: "Jakarta",
            caseSensitive: false,
          },
          {
            order: 4,
            type: "ESSAY",
            text: "Explain photosynthesis",
            points: 25,
          },
        ],
      },
    },
    include: {
      questions: {
        include: { options: true },
        orderBy: { order: "asc" },
      },
    },
  });

  const [q1, q2, q3, q4] = testQuiz.questions;
  const q1Correct = q1.options.find((o) => o.isCorrect);
  const q2CorrectIds = q2.options.filter((o) => o.isCorrect).map((o) => o.id);

  // Simulated Graded Details from route logic
  const gradedDetails = [
    {
      questionId: q1.id,
      selectedOptionIds: [q1Correct.id],
      textResponse: null,
      isAutoGraded: true,
      earnedPoints: 25,
      aiSuggestedScore: undefined,
      aiEvaluationFeedback: undefined,
    },
    {
      questionId: q2.id,
      selectedOptionIds: q2CorrectIds,
      textResponse: null,
      isAutoGraded: true,
      earnedPoints: 25,
      aiSuggestedScore: undefined,
      aiEvaluationFeedback: undefined,
    },
    {
      questionId: q3.id,
      selectedOptionIds: [],
      textResponse: "jakarta",
      isAutoGraded: true,
      earnedPoints: 25,
      aiSuggestedScore: undefined,
      aiEvaluationFeedback: undefined,
    },
    {
      questionId: q4.id,
      selectedOptionIds: [],
      textResponse: "Process by which plants use sunlight...",
      isAutoGraded: true,
      earnedPoints: 20,
      aiSuggestedScore: 20,
      aiEvaluationFeedback: "Good explanation",
    },
  ];

  const totalScore = 100;
  const earnedScore = 95;
  const hasPendingEssays = true;
  const answersPayload = {
    [q1.id]: { optionId: q1Correct.id },
    [q2.id]: { selectedOptionIds: q2CorrectIds },
    [q3.id]: { textResponse: "jakarta" },
    [q4.id]: { textResponse: "Process by which plants use sunlight..." },
  };

  // Test Transactional Execution
  const transactionResult = await prisma.$transaction(
    async (tx) => {
      const existingAttempt = await tx.quizAttempt.findFirst({
        where: {
          quizId: testQuiz.id,
          userId: testUser.id,
        },
        orderBy: { createdAt: "desc" },
      });

      let attemptRecord;
      if (existingAttempt) {
        attemptRecord = await tx.quizAttempt.update({
          where: { id: existingAttempt.id },
          data: {
            score: earnedScore,
            totalScore,
            status: hasPendingEssays ? "SUBMITTED" : "GRADED",
            isFullyGraded: !hasPendingEssays,
            submittedAt: new Date(),
            answers: JSON.stringify(answersPayload),
          },
        });
      } else {
        attemptRecord = await tx.quizAttempt.create({
          data: {
            quizId: testQuiz.id,
            userId: testUser.id,
            score: earnedScore,
            totalScore,
            status: hasPendingEssays ? "SUBMITTED" : "GRADED",
            isFullyGraded: !hasPendingEssays,
            startedAt: new Date(),
            submittedAt: new Date(),
            answers: JSON.stringify(answersPayload),
          },
        });
      }

      const answerUpsertPromises = gradedDetails.map((detail) =>
        tx.quizStudentAnswer.upsert({
          where: {
            attemptId_questionId: {
              attemptId: attemptRecord.id,
              questionId: detail.questionId,
            },
          },
          update: {
            selectedOptionIds:
              detail.selectedOptionIds && detail.selectedOptionIds.length > 0
                ? JSON.stringify(detail.selectedOptionIds)
                : null,
            textResponse: detail.textResponse || null,
            isAutoGraded: detail.isAutoGraded,
            earnedPoints: detail.earnedPoints,
            aiSuggestedScore: detail.aiSuggestedScore,
            aiEvaluationFeedback: detail.aiEvaluationFeedback,
          },
          create: {
            attemptId: attemptRecord.id,
            questionId: detail.questionId,
            selectedOptionIds:
              detail.selectedOptionIds && detail.selectedOptionIds.length > 0
                ? JSON.stringify(detail.selectedOptionIds)
                : null,
            textResponse: detail.textResponse || null,
            isAutoGraded: detail.isAutoGraded,
            earnedPoints: detail.earnedPoints,
            aiSuggestedScore: detail.aiSuggestedScore,
            aiEvaluationFeedback: detail.aiEvaluationFeedback,
          },
        })
      );

      await Promise.all(answerUpsertPromises);
      return attemptRecord;
    },
    {
      timeout: 15000,
      maxWait: 5000,
    }
  );

  assert(Boolean(transactionResult && transactionResult.id), "CBT Submission: Transaction committed successfully");
  assert(transactionResult.score === 95, "CBT Submission: Score is 95/100");
  assert(transactionResult.status === "SUBMITTED", "CBT Submission: Status is SUBMITTED with pending essays");

  const savedAnswers = await prisma.quizStudentAnswer.findMany({
    where: { attemptId: transactionResult.id },
  });
  assert(savedAnswers.length === 4, `CBT Submission: Exactly 4 QuizStudentAnswer records written (actual: ${savedAnswers.length})`);

  const q1Saved = savedAnswers.find((a) => a.questionId === q1.id);
  assert(q1Saved && q1Saved.earnedPoints === 25, "CBT Submission: Question 1 points = 25");

  const q4Saved = savedAnswers.find((a) => a.questionId === q4.id);
  assert(q4Saved && q4Saved.aiSuggestedScore === 20 && q4Saved.aiEvaluationFeedback === "Good explanation", "CBT Submission: Question 4 AI evaluation saved");

  // Clean up
  await prisma.quizStudentAnswer.deleteMany({ where: { attemptId: transactionResult.id } });
  await prisma.quizAttempt.deleteMany({ where: { id: transactionResult.id } });
  await prisma.question.deleteMany({ where: { quizId: testQuiz.id } });
  await prisma.quiz.deleteMany({ where: { id: testQuiz.id } });
  await prisma.user.deleteMany({ where: { id: testUser.id } });
  console.log("  [CLEANUP] CBT transaction test artifacts cleaned up cleanly.");
}

// -------------------------------------------------------------
// SUITE 2: Bot Group Member Sync Batching (Set + Single Query + Map)
// -------------------------------------------------------------
async function runBotMemberSyncBatchTest() {
  console.log("\n=======================================================");
  console.log("SUITE 2: Bot Group Member Sync Batching & Fast Map Lookup");
  console.log("=======================================================");

  const testSuffix = Date.now();
  const u1Phone = `628111${testSuffix}`;
  const u2Phone = `628222${testSuffix}`;
  const u3Phone = `628333${testSuffix}`;

  const u1 = await prisma.user.create({
    data: { name: `[M3_BOT] Alice`, phoneNumber: u1Phone, status: "COMPLETED", role: "STUDENT" },
  });
  const u2 = await prisma.user.create({
    data: { name: `[M3_BOT] Bob`, phoneNumber: u2Phone, status: "IN_PROGRESS", role: "STUDENT" },
  });
  const u3 = await prisma.user.create({
    data: { name: `[M3_BOT] Charlie`, phoneNumber: u3Phone, status: "COMPLETED", faceDescriptor: "[0.1, 0.2]", role: "STUDENT" },
  });

  // Simulated WhatsApp metadata participants
  const mockParticipants = [
    { id: `${u1Phone}@s.whatsapp.net` },
    { id: `1234567890@lid`, pn: `${u2Phone}@s.whatsapp.net` },
    { id: `0${u3Phone.slice(2)}@s.whatsapp.net` }, // local 08... format in WhatsApp JID
    { id: `628999999999@s.whatsapp.net` }, // Unregistered user
  ];

  const resolvedLidMap = new Map();
  const cleanBotNum = "628000000000";
  const cleanBotLid = "9999999999";

  // PASS 1: Pre-process participants & collect candidate phones
  const validParticipants = [];
  const candidatePhonesSet = new Set();

  for (const p of mockParticipants) {
    const fullJid = p.id;
    const pnJid = p.pn || p.phoneNumber || p.phone || resolvedLidMap.get(fullJid);

    let displayPhone = "";
    if (pnJid) {
      const rawPn = pnJid.split("@")[0].split(":")[0];
      displayPhone = rawPn.startsWith("0") ? "62" + rawPn.slice(1) : rawPn;
    } else if (fullJid.endsWith("@s.whatsapp.net")) {
      const rawPn = fullJid.split("@")[0].split(":")[0];
      displayPhone = rawPn.startsWith("0") ? "62" + rawPn.slice(1) : rawPn;
    } else {
      displayPhone = "";
    }

    const cleanMemberNum = fullJid.split("@")[0].split(":")[0];
    const cleanMemberPn = pnJid ? pnJid.split("@")[0].split(":")[0] : "";

    if (
      (cleanBotNum && (cleanMemberNum === cleanBotNum || cleanMemberPn === cleanBotNum)) ||
      (cleanBotLid && (cleanMemberNum === cleanBotLid || cleanMemberPn === cleanBotLid))
    ) {
      continue;
    }

    validParticipants.push({
      p,
      fullJid,
      pnJid,
      displayPhone,
      cleanMemberNum,
      cleanMemberPn,
    });

    if (displayPhone) {
      candidatePhonesSet.add(displayPhone);
      if (displayPhone.startsWith("62")) candidatePhonesSet.add("0" + displayPhone.slice(2));
      if (displayPhone.startsWith("0")) candidatePhonesSet.add("62" + displayPhone.slice(1));
    }
    if (cleanMemberPn) {
      candidatePhonesSet.add(cleanMemberPn);
      if (cleanMemberPn.startsWith("0")) candidatePhonesSet.add("62" + cleanMemberPn.slice(1));
      if (cleanMemberPn.startsWith("62")) candidatePhonesSet.add("0" + cleanMemberPn.slice(2));
    }
    if (cleanMemberNum) {
      candidatePhonesSet.add(cleanMemberNum);
      if (cleanMemberNum.startsWith("0")) candidatePhonesSet.add("62" + cleanMemberNum.slice(1));
      if (cleanMemberNum.startsWith("62")) candidatePhonesSet.add("0" + cleanMemberNum.slice(2));
    }
  }

  assert(candidatePhonesSet.size > 0, `Bot Sync Pass 1: Collected ${candidatePhonesSet.size} candidate phone variations`);

  // SINGLE BATCH QUERY
  const candidatePhones = Array.from(candidatePhonesSet).filter(Boolean);
  const existingUsers =
    candidatePhones.length > 0
      ? await prisma.user.findMany({
          where: {
            phoneNumber: { in: candidatePhones },
          },
        })
      : [];

  assert(existingUsers.length === 3, `Bot Sync Single Batch Query: Found exactly 3 registered users (actual: ${existingUsers.length})`);

  // IN-MEMORY MAP
  const userByPhoneMap = new Map();
  for (const u of existingUsers) {
    if (!u.phoneNumber) continue;
    userByPhoneMap.set(u.phoneNumber, u);
    const digits = u.phoneNumber.replace(/\D/g, "");
    userByPhoneMap.set(digits, u);
    if (digits.startsWith("62")) {
      userByPhoneMap.set("0" + digits.slice(2), u);
    } else if (digits.startsWith("0")) {
      userByPhoneMap.set("62" + digits.slice(1), u);
    }
  }

  // PASS 2: Match in memory
  const membersList = [];
  for (const item of validParticipants) {
    const { p, fullJid, pnJid, displayPhone, cleanMemberNum, cleanMemberPn } = item;

    const participant =
      (displayPhone ? userByPhoneMap.get(displayPhone) : null) ||
      (cleanMemberPn ? userByPhoneMap.get(cleanMemberPn) : null) ||
      userByPhoneMap.get(cleanMemberNum) ||
      null;

    const finalPhone =
      participant && participant.phoneNumber && participant.phoneNumber.startsWith("62")
        ? participant.phoneNumber
        : displayPhone || fullJid.split("@")[0];

    let targetJid = pnJid;
    if (!targetJid && participant?.phoneNumber && participant.phoneNumber.startsWith("62")) {
      targetJid = `${participant.phoneNumber}@s.whatsapp.net`;
    }
    if (!targetJid) {
      targetJid = fullJid;
    }

    membersList.push({
      jid: targetJid,
      phoneNumber: finalPhone,
      name: participant?.name || p.name || p.notify || null,
      status: participant?.status || "NOT_STARTED",
      isExcluded: participant?.isExcluded || false,
      isRegistered: participant?.status === "COMPLETED",
      faceRegistered: Boolean(participant?.faceDescriptor),
    });
  }

  assert(membersList.length === 4, `Bot Sync Pass 2: 4 members resolved`);
  const m1 = membersList.find((m) => m.name === "[M3_BOT] Alice");
  assert(m1 && m1.isRegistered === true && m1.status === "COMPLETED", "Alice correctly resolved as COMPLETED");

  const m2 = membersList.find((m) => m.name === "[M3_BOT] Bob");
  assert(m2 && m2.isRegistered === false && m2.status === "IN_PROGRESS", "Bob correctly resolved as IN_PROGRESS");

  const m3 = membersList.find((m) => m.name === "[M3_BOT] Charlie");
  assert(m3 && m3.faceRegistered === true, "Charlie correctly resolved with faceRegistered: true");

  const m4 = membersList.find((m) => m.phoneNumber === "628999999999");
  assert(m4 && m4.status === "NOT_STARTED" && m4.isRegistered === false, "Unregistered user resolved as NOT_STARTED");

  // Clean up
  await prisma.user.deleteMany({
    where: { id: { in: [u1.id, u2.id, u3.id] } },
  });
  console.log("  [CLEANUP] Bot test artifacts cleaned up cleanly.");
}

async function main() {
  try {
    await runCbtSubmissionTransactionTest();
    await runBotMemberSyncBatchTest();

    console.log("\n=======================================================");
    console.log("M3 BATCHING & TRANSACTION VERIFICATION SUMMARY");
    console.log("=======================================================");
    console.log(`Total Tests Run : ${totalTests}`);
    console.log(`Passed          : ${passedTests}`);
    console.log(`Failed          : ${failedTests}`);
    if (failedTests > 0) {
      console.log("\nFailed Assertions:");
      failures.forEach((f) => console.log(f));
      process.exit(1);
    } else {
      console.log("\n>>> ALL M3 EMPIRICAL TESTS PASSED (100%)! <<<");
      process.exit(0);
    }
  } catch (err) {
    console.error("Fatal test error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
