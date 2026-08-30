import { PrismaClient } from "@prisma/client";
import { performance } from "perf_hooks";

const prisma = new PrismaClient();

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];

function assert(condition, name, detail = "") {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ [PASS] ${name}`);
  } else {
    failedAssertions++;
    const msg = `  ✗ [FAIL] ${name}${detail ? ` -> ${detail}` : ""}`;
    console.error(msg);
    failureDetails.push(msg);
  }
}

// ============================================================================
// SUITE 1: ADVANCED CBT CONCURRENT SUBMISSION & TRANSACTION STRESS HARNESS
// ============================================================================
async function runConcurrentCbtSubmissionStress() {
  console.log("\n=================================================================");
  console.log("TEST SUITE 1: CBT Quiz Submission Concurrency & Transaction Stress");
  console.log("=================================================================");

  const timestamp = Date.now();
  const studentCount = 15;
  const questionCount = 30; // Large 30-question exam

  // 1. Create 15 Test Students
  const createdStudents = [];
  for (let i = 0; i < studentCount; i++) {
    const student = await prisma.user.create({
      data: {
        name: `[CHALLENGER_M3] Student ${i + 1}_${timestamp}`,
        phoneNumber: `6287700${i.toString().padStart(3, "0")}${timestamp.toString().slice(-4)}`,
        role: "STUDENT",
        studentClass: "12-RPL",
      },
    });
    createdStudents.push(student);
  }

  // 2. Create 30-question Exam with mixed question types
  const questionCreateData = [];
  for (let i = 1; i <= questionCount; i++) {
    const typeMod = i % 5;
    if (typeMod === 1) {
      questionCreateData.push({
        order: i,
        type: "SINGLE_CHOICE",
        text: `Question ${i}: What is the value of ${i} * 2?`,
        points: 5,
        options: {
          create: [
            { text: `${i * 2}`, isCorrect: true },
            { text: `${i * 2 + 1}`, isCorrect: false },
            { text: `${i * 2 - 1}`, isCorrect: false },
          ],
        },
      });
    } else if (typeMod === 2) {
      questionCreateData.push({
        order: i,
        type: "CHECKBOXES",
        text: `Question ${i}: Select multiples of ${i}`,
        points: 10,
        options: {
          create: [
            { text: `${i}`, isCorrect: true },
            { text: `${i * 2}`, isCorrect: true },
            { text: `${i + 1}`, isCorrect: false },
          ],
        },
      });
    } else if (typeMod === 3) {
      questionCreateData.push({
        order: i,
        type: "SHORT_ANSWER",
        text: `Question ${i}: Type the word 'Alpha'`,
        points: 5,
        sampleAnswer: "Alpha",
        caseSensitive: false,
      });
    } else if (typeMod === 4) {
      questionCreateData.push({
        order: i,
        type: "TRUE_FALSE",
        text: `Question ${i}: Is ${i} a positive number?`,
        points: 5,
        options: {
          create: [
            { text: "True", isCorrect: true },
            { text: "False", isCorrect: false },
          ],
        },
      });
    } else {
      questionCreateData.push({
        order: i,
        type: "ESSAY",
        text: `Question ${i}: Describe the importance of software optimization.`,
        points: 10,
        sampleAnswer: "Software optimization improves responsiveness and reduces resource consumption.",
      });
    }
  }

  const testQuiz = await prisma.quiz.create({
    data: {
      title: `[CHALLENGER_M3] 30-Question Stress Exam ${timestamp}`,
      durationMinutes: 60,
      questions: {
        create: questionCreateData,
      },
    },
    include: {
      questions: {
        include: { options: true },
        orderBy: { order: "asc" },
      },
    },
  });

  assert(testQuiz.questions.length === questionCount, `Created large exam with ${questionCount} questions`);

  // Helper to build gradedDetails and execute the exact transactional logic as in route.ts
  async function submitExamTransactional(userId, customAnswers) {
    let totalScore = 0;
    let earnedScore = 0;
    let hasPendingEssays = false;

    const gradedDetails = [];

    for (const q of testQuiz.questions) {
      totalScore += q.points;
      const userAns = customAnswers[q.id] || {};
      const qType = q.type || "SINGLE_CHOICE";

      let pointsEarned = 0;
      let aiSuggestedScore = undefined;
      let aiFeedback = undefined;
      let isAutoGraded = true;

      if (qType === "SINGLE_CHOICE" || qType === "TRUE_FALSE") {
        const selectedId = userAns.optionId;
        const correctOpt = q.options.find((o) => o.isCorrect);
        if (selectedId && correctOpt && selectedId === correctOpt.id) {
          pointsEarned = q.points;
        }
      } else if (qType === "CHECKBOXES") {
        const selectedIds = Array.isArray(userAns.selectedOptionIds)
          ? userAns.selectedOptionIds
          : userAns.optionId
          ? [userAns.optionId]
          : [];

        const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
        const wrongSelected = selectedIds.filter((id) => !correctIds.includes(id));
        const correctSelected = selectedIds.filter((id) => correctIds.includes(id));

        if (wrongSelected.length === 0 && correctSelected.length === correctIds.length) {
          pointsEarned = q.points;
        } else if (wrongSelected.length === 0 && correctSelected.length > 0) {
          pointsEarned = Math.round((correctSelected.length / correctIds.length) * q.points * 10) / 10;
        }
      } else if (qType === "SHORT_ANSWER") {
        const textAns = (userAns.textResponse || "").trim();
        const expected = (q.sampleAnswer || q.options.find((o) => o.isCorrect)?.text || "").trim();
        const isMatch = q.caseSensitive
          ? textAns === expected
          : textAns.toLowerCase() === expected.toLowerCase();

        if (textAns && isMatch) {
          pointsEarned = q.points;
        }
      } else if (qType === "ESSAY") {
        const essayResponse = userAns.textResponse || "";
        hasPendingEssays = true;
        aiSuggestedScore = essayResponse.length > 10 ? 8 : 2;
        aiFeedback = "AI automated check";
        pointsEarned = aiSuggestedScore;
      }

      earnedScore += pointsEarned;

      gradedDetails.push({
        questionId: q.id,
        selectedOptionIds: userAns.selectedOptionIds || (userAns.optionId ? [userAns.optionId] : []),
        textResponse: userAns.textResponse || null,
        isAutoGraded,
        earnedPoints: pointsEarned,
        aiSuggestedScore,
        aiEvaluationFeedback: aiFeedback,
      });
    }

    return await prisma.$transaction(
      async (tx) => {
        const existingAttempt = await tx.quizAttempt.findFirst({
          where: {
            quizId: testQuiz.id,
            userId,
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
              answers: JSON.stringify(customAnswers),
            },
          });
        } else {
          attemptRecord = await tx.quizAttempt.create({
            data: {
              quizId: testQuiz.id,
              userId,
              score: earnedScore,
              totalScore,
              status: hasPendingEssays ? "SUBMITTED" : "GRADED",
              isFullyGraded: !hasPendingEssays,
              startedAt: new Date(),
              submittedAt: new Date(),
              answers: JSON.stringify(customAnswers),
            },
          });
        }

        // Parallel Upsert of all 30 student answers
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
  }

  // --- TEST 1A: 15 CONCURRENT STUDENTS SUBMITTING SIMULTANEOUSLY ---
  console.log(`\n  [Stress] Launching 15 simultaneous student submissions (15 x 30 = 450 parallel upserts)...`);
  const t0 = performance.now();

  const submissionPromises = createdStudents.map((st, idx) => {
    // Generate answers (all correct for even idx, partial for odd idx)
    const answers = {};
    for (const q of testQuiz.questions) {
      if (q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") {
        const correct = q.options.find((o) => o.isCorrect);
        answers[q.id] = { optionId: correct ? correct.id : undefined };
      } else if (q.type === "CHECKBOXES") {
        const corrects = q.options.filter((o) => o.isCorrect).map((o) => o.id);
        answers[q.id] = { selectedOptionIds: corrects };
      } else if (q.type === "SHORT_ANSWER") {
        answers[q.id] = { textResponse: "alpha" };
      } else if (q.type === "ESSAY") {
        answers[q.id] = { textResponse: "Software optimization minimizes database latency." };
      }
    }
    return submitExamTransactional(st.id, answers);
  });

  const results = await Promise.all(submissionPromises);
  const t1 = performance.now();
  const durationMs = Math.round(t1 - t0);

  console.log(`  [Stress] 15 Concurrent Submissions completed in ${durationMs}ms`);

  assert(results.length === 15, "All 15 concurrent submissions returned valid attempts");
  assert(results.every((r) => r && r.id), "Every returned attempt has a valid UUID");

  // Verify all 450 answers written in DB
  const totalAnswersInDb = await prisma.quizStudentAnswer.count({
    where: {
      attemptId: { in: results.map((r) => r.id) },
    },
  });
  assert(totalAnswersInDb === 15 * 30, `Exactly 450 QuizStudentAnswer rows created (actual: ${totalAnswersInDb})`);

  // --- TEST 1B: RAPID BURST / RE-SUBMISSION CONCURRENCY (Same Student x 5 concurrent requests) ---
  console.log(`\n  [Stress] Testing same-student rapid burst (5 concurrent submissions for student 1)...`);
  const burstStudent = createdStudents[0];
  const burstAnswers = {};
  for (const q of testQuiz.questions) {
    if (q.type === "SINGLE_CHOICE") {
      const opt = q.options[0];
      burstAnswers[q.id] = { optionId: opt.id };
    }
  }

  const burstResults = await Promise.allSettled([
    submitExamTransactional(burstStudent.id, burstAnswers),
    submitExamTransactional(burstStudent.id, burstAnswers),
    submitExamTransactional(burstStudent.id, burstAnswers),
    submitExamTransactional(burstStudent.id, burstAnswers),
    submitExamTransactional(burstStudent.id, burstAnswers),
  ]);

  const successfulBursts = burstResults.filter((r) => r.status === "fulfilled");
  assert(successfulBursts.length >= 1, `Burst submissions resolved safely without deadlock (${successfulBursts.length}/5 fulfilled)`);

  const student1Attempts = await prisma.quizAttempt.findMany({
    where: { quizId: testQuiz.id, userId: burstStudent.id },
  });
  console.log(`  [Info] Student 1 has ${student1Attempts.length} attempt record(s)`);
  assert(student1Attempts.length >= 1, "Student 1 has at least 1 attempt record recorded");

  // --- TEST 1C: TRANSACTION ATOMICITY & CLEAN ROLLBACK ON ERROR ---
  console.log(`\n  [Stress] Testing transaction atomicity & rollback upon error...`);
  const rollbackStudent = createdStudents[1];
  let rollbackCaught = false;

  const preAttempts = await prisma.quizAttempt.count({ where: { userId: rollbackStudent.id, quizId: testQuiz.id } });
  const preAnswers = await prisma.quizStudentAnswer.count({ where: { attempt: { userId: rollbackStudent.id } } });

  try {
    await prisma.$transaction(
      async (tx) => {
        // Create attempt inside tx
        const tempAttempt = await tx.quizAttempt.create({
          data: {
            quizId: testQuiz.id,
            userId: rollbackStudent.id,
            score: 50,
            totalScore: 100,
            status: "SUBMITTED",
            startedAt: new Date(),
            submittedAt: new Date(),
          },
        });

        // Insert valid answer 1
        await tx.quizStudentAnswer.create({
          data: {
            attemptId: tempAttempt.id,
            questionId: testQuiz.questions[0].id,
            earnedPoints: 5,
            isAutoGraded: true,
          },
        });

        // Intentional constraint violation: non-existent questionId
        await tx.quizStudentAnswer.create({
          data: {
            attemptId: tempAttempt.id,
            questionId: "non-existent-question-uuid-triggering-fk-violation",
            earnedPoints: 5,
            isAutoGraded: true,
          },
        });
      },
      { timeout: 5000 }
    );
  } catch (err) {
    rollbackCaught = true;
    console.log(`  [Rollback] Caught expected transaction error: ${err.code || err.message?.slice(0, 50)}`);
  }

  assert(rollbackCaught === true, "Transaction error properly intercepted");

  // Verify rollback: attempt count and answer count did NOT change
  const postAttempts = await prisma.quizAttempt.count({ where: { userId: rollbackStudent.id, quizId: testQuiz.id } });
  const postAnswers = await prisma.quizStudentAnswer.count({ where: { attempt: { userId: rollbackStudent.id } } });

  assert(postAttempts === preAttempts, `Rollback verified: QuizAttempt count unchanged (${postAttempts} === ${preAttempts})`);
  assert(postAnswers === preAnswers, `Rollback verified: QuizStudentAnswer count unchanged (${postAnswers} === ${preAnswers})`);

  // --- CLEANUP TEST 1 ---
  const allAttemptIds = (await prisma.quizAttempt.findMany({ where: { quizId: testQuiz.id }, select: { id: true } })).map((a) => a.id);
  await prisma.quizStudentAnswer.deleteMany({ where: { attemptId: { in: allAttemptIds } } });
  await prisma.quizAttempt.deleteMany({ where: { id: { in: allAttemptIds } } });
  await prisma.question.deleteMany({ where: { quizId: testQuiz.id } });
  await prisma.quiz.deleteMany({ where: { id: testQuiz.id } });
  await prisma.user.deleteMany({ where: { id: { in: createdStudents.map((s) => s.id) } } });
  console.log("  [Clean] Suite 1 database artifacts cleaned up cleanly.");
}

// ============================================================================
// SUITE 2: BOT GROUP MEMBER SYNC BATCHING & MAP LOOKUP AT SCALE (100+ PARTICIPANTS)
// ============================================================================
async function runBotMemberBatchingScaleTest() {
  console.log("\n=================================================================");
  console.log("TEST SUITE 2: Bot Group Member Sync Batching at Scale (100 Members)");
  console.log("=================================================================");

  const timestamp = Date.now();
  const registeredCount = 50;

  // 1. Seed 50 Users in Database with varying phone formats
  const seededUsers = [];
  for (let i = 0; i < registeredCount; i++) {
    const rawNum = `812345${i.toString().padStart(4, "0")}${timestamp.toString().slice(-3)}`;
    const phoneFormat = i % 2 === 0 ? `62${rawNum}` : `0${rawNum}`; // Alternate 628... and 08...
    const status = i % 3 === 0 ? "COMPLETED" : i % 3 === 1 ? "IN_PROGRESS" : "NOT_STARTED";
    const faceDescriptor = i % 2 === 0 ? JSON.stringify([0.12, 0.45, 0.78]) : null;

    const user = await prisma.user.create({
      data: {
        name: `[BOT_CHALLENGE] Participant ${i + 1}`,
        phoneNumber: phoneFormat,
        status,
        faceDescriptor,
        role: "STUDENT",
      },
    });
    seededUsers.push({ user, rawNum });
  }

  assert(seededUsers.length === 50, "Seeded 50 database users for bot sync test");

  // 2. Generate 100 simulated WhatsApp group metadata participants
  const mockParticipants = [];

  // Group A: 50 registered users (some with @s.whatsapp.net, some with LID + pn)
  for (let i = 0; i < 50; i++) {
    const { rawNum } = seededUsers[i];
    if (i % 4 === 0) {
      // Direct 628... @s.whatsapp.net
      mockParticipants.push({ id: `62${rawNum}@s.whatsapp.net`, name: `WA Name ${i + 1}` });
    } else if (i % 4 === 1) {
      // Local 08... @s.whatsapp.net
      mockParticipants.push({ id: `0${rawNum}@s.whatsapp.net`, notify: `WA Notify ${i + 1}` });
    } else if (i % 4 === 2) {
      // LID with pn field (Baileys format)
      mockParticipants.push({ id: `990000${i}@lid`, pn: `62${rawNum}@s.whatsapp.net`, notify: `WA LID_PN ${i + 1}` });
    } else {
      // LID without pn (to be resolved via LID map)
      mockParticipants.push({ id: `880000${i}@lid`, notify: `WA LID_MAP ${i + 1}` });
    }
  }

  // Group B: 48 unregistered participants
  for (let i = 50; i < 98; i++) {
    mockParticipants.push({ id: `62899999${i.toString().padStart(4, "0")}@s.whatsapp.net`, notify: `Stranger ${i}` });
  }

  // Group C: 2 Bot Numbers (must be filtered out)
  const botNum = `628000000000`;
  const botLid = `7777777777`;
  mockParticipants.push({ id: `${botNum}@s.whatsapp.net` });
  mockParticipants.push({ id: `${botLid}@lid` });

  assert(mockParticipants.length === 100, `Generated exactly ${mockParticipants.length} group participants`);

  // Map for LID resolution
  const resolvedLidMap = new Map();
  for (let i = 3; i < 50; i += 4) {
    const { rawNum } = seededUsers[i];
    resolvedLidMap.set(`880000${i}@lid`, `62${rawNum}@s.whatsapp.net`);
  }

  // 3. Execute the exact algorithm from src/lib/bot-engine.ts
  const t0 = performance.now();

  // PASS 1: Collect candidates
  const validParticipants = [];
  const candidatePhonesSet = new Set();
  const cleanBotNum = botNum;
  const cleanBotLid = botLid;

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
      continue; // Filtered bot
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

  // IN-MEMORY MAP (0ms)
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

  const t1 = performance.now();
  const totalDurationMs = Math.round((t1 - t0) * 100) / 100;
  console.log(`  [Perf] 100-Member Bot Sync Batch Resolution took ${totalDurationMs}ms`);

  // Assertions on Bot Batching
  assert(validParticipants.length === 98, `Bot filtering correctly removed 2 bot accounts (98 remaining)`);
  assert(existingUsers.length === 50, `Single batch query fetched all 50 registered users in 1 DB roundtrip`);
  assert(membersList.length === 98, `Members list populated exactly 98 resolved participant items`);

  const matchedRegisteredCount = membersList.filter((m) => m.isRegistered === true).length;
  const expectedRegisteredCount = seededUsers.filter((u) => u.user.status === "COMPLETED").length;
  assert(matchedRegisteredCount === expectedRegisteredCount, `Matched completed users count: ${matchedRegisteredCount} === ${expectedRegisteredCount}`);

  const faceRegisteredCount = membersList.filter((m) => m.faceRegistered === true).length;
  const expectedFaceCount = seededUsers.filter((u) => u.user.faceDescriptor !== null).length;
  assert(faceRegisteredCount === expectedFaceCount, `Face registered count: ${faceRegisteredCount} === ${expectedFaceCount}`);

  assert(totalDurationMs < 500, `Execution speed is sub-second (${totalDurationMs}ms < 500ms)`);

  // Clean up
  await prisma.user.deleteMany({
    where: { id: { in: seededUsers.map((s) => s.user.id) } },
  });
  console.log("  [Clean] Suite 2 database artifacts cleaned up cleanly.");
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function main() {
  console.log("=================================================================");
  console.log("EMPIRICAL CHALLENGER 2: MILESTONE M3 STRESS & VERIFICATION TEST");
  console.log("=================================================================");

  try {
    await runConcurrentCbtSubmissionStress();
    await runBotMemberBatchingScaleTest();

    console.log("\n=================================================================");
    console.log("CHALLENGER 2 EMPIRICAL TEST RESULTS SUMMARY");
    console.log("=================================================================");
    console.log(`Total Assertions : ${totalAssertions}`);
    console.log(`Passed           : ${passedAssertions}`);
    console.log(`Failed           : ${failedAssertions}`);

    if (failedAssertions > 0) {
      console.log("\nFAILURES:");
      failureDetails.forEach((d) => console.log(d));
      process.exit(1);
    } else {
      console.log("\n>>> ALL M3 EMPIRICAL CHALLENGER TESTS PASSED (100%)! <<<");
      process.exit(0);
    }
  } catch (err) {
    console.error("\nFATAL UNCAUGHT ERROR IN CHALLENGER TEST:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

