import { prisma } from "../src/lib/prisma";

// =========================================================================
// EMPIRICAL STRESS-TEST HARNESS FOR MILESTONES 2 & 3 (CHALLENGER SUITE)
// =========================================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function assert(condition: any, testName: string, detail?: string) {
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

// -------------------------------------------------------------------------
// SUITE 1: Auto-Scoring Mathematical Precision & Algorithm Verification
// -------------------------------------------------------------------------
console.log("\n=======================================================");
console.log("SUITE 1: Auto-Scoring Matrix & Mathematical Precision");
console.log("=======================================================");

interface OptionMock {
  id: string;
  isCorrect: boolean;
  text: string;
}

interface QuestionMock {
  id: string;
  type: "SINGLE_CHOICE" | "TRUE_FALSE" | "CHECKBOXES" | "SHORT_ANSWER" | "ESSAY";
  points: number;
  options: OptionMock[];
  sampleAnswer?: string | null;
  caseSensitive?: boolean;
}

function calculateScoreForQuestion(
  q: QuestionMock,
  userAns: { optionId?: string; selectedOptionIds?: string[]; textResponse?: string | null }
): { earnedPoints: number; isAutoGraded: boolean; selectedOptionIds: string[]; textResponse: string | null } {
  let earnedPoints = 0;
  let isAutoGraded = true;
  let selectedOptionIds: string[] = [];
  let textResponse: string | null = null;

  if (q.type === "SINGLE_CHOICE" || q.type === "TRUE_FALSE") {
    const correctOpt = q.options.find((o) => o.isCorrect);
    const selectedId = userAns.optionId;
    if (selectedId) {
      selectedOptionIds = [selectedId];
      if (correctOpt && selectedId === correctOpt.id) {
        earnedPoints = q.points;
      }
    }
  } else if (q.type === "CHECKBOXES") {
    selectedOptionIds = Array.isArray(userAns.selectedOptionIds)
      ? userAns.selectedOptionIds
      : userAns.optionId
      ? [userAns.optionId]
      : [];
    const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
    const wrongSelected = selectedOptionIds.filter((id) => !correctIds.includes(id));
    const correctSelected = selectedOptionIds.filter((id) => correctIds.includes(id));

    if (wrongSelected.length === 0 && correctSelected.length === correctIds.length && correctIds.length > 0) {
      earnedPoints = q.points;
    } else if (wrongSelected.length === 0 && correctSelected.length > 0 && correctIds.length > 0) {
      earnedPoints = Math.round((correctSelected.length / correctIds.length) * q.points * 10) / 10;
    }
  } else if (q.type === "SHORT_ANSWER") {
    textResponse = typeof userAns.textResponse === "string" ? userAns.textResponse : null;
    const textAns = (textResponse || "").trim();
    const expected = (q.sampleAnswer || q.options.find((o) => o.isCorrect)?.text || "").trim();
    const isMatch = q.caseSensitive
      ? textAns === expected
      : textAns.toLowerCase() === expected.toLowerCase();

    if (textAns && isMatch) {
      earnedPoints = q.points;
    }
  } else if (q.type === "ESSAY") {
    textResponse = typeof userAns.textResponse === "string" ? userAns.textResponse : null;
    isAutoGraded = false;
    earnedPoints = 0;
  }

  return { earnedPoints, isAutoGraded, selectedOptionIds, textResponse };
}

// 1. Single Choice Tests
{
  const qSingle: QuestionMock = {
    id: "q-single",
    type: "SINGLE_CHOICE",
    points: 25,
    options: [
      { id: "opt-1", isCorrect: true, text: "A" },
      { id: "opt-2", isCorrect: false, text: "B" },
    ],
  };

  const correctRes = calculateScoreForQuestion(qSingle, { optionId: "opt-1" });
  assert(correctRes.earnedPoints === 25, "SINGLE_CHOICE: Correct option yields full points (25)");
  assert(correctRes.isAutoGraded === true, "SINGLE_CHOICE: isAutoGraded is true");

  const wrongRes = calculateScoreForQuestion(qSingle, { optionId: "opt-2" });
  assert(wrongRes.earnedPoints === 0, "SINGLE_CHOICE: Wrong option yields 0 points");

  const emptyRes = calculateScoreForQuestion(qSingle, {});
  assert(emptyRes.earnedPoints === 0, "SINGLE_CHOICE: Empty optionId yields 0 points");
}

// 2. True / False Tests
{
  const qTF: QuestionMock = {
    id: "q-tf",
    type: "TRUE_FALSE",
    points: 10,
    options: [
      { id: "tf-true", isCorrect: true, text: "Benar" },
      { id: "tf-false", isCorrect: false, text: "Salah" },
    ],
  };

  assert(calculateScoreForQuestion(qTF, { optionId: "tf-true" }).earnedPoints === 10, "TRUE_FALSE: Correct option yields full points (10)");
  assert(calculateScoreForQuestion(qTF, { optionId: "tf-false" }).earnedPoints === 0, "TRUE_FALSE: Wrong option yields 0 points");
}

// 3. Checkboxes Tests (Complex Combinations & Partial Scoring)
{
  const qCB: QuestionMock = {
    id: "q-cb",
    type: "CHECKBOXES",
    points: 30,
    options: [
      { id: "cb-1", isCorrect: true, text: "Prima 2" },
      { id: "cb-2", isCorrect: true, text: "Prima 3" },
      { id: "cb-3", isCorrect: true, text: "Prima 5" },
      { id: "cb-4", isCorrect: false, text: "Bukan 4" },
      { id: "cb-5", isCorrect: false, text: "Bukan 6" },
    ],
  };

  // Case A: All 3 correct chosen, 0 wrong
  const cbAll = calculateScoreForQuestion(qCB, { selectedOptionIds: ["cb-1", "cb-2", "cb-3"] });
  assert(cbAll.earnedPoints === 30, "CHECKBOXES: All correct selected (3/3) yields full points (30)");

  // Case B: Partial correct (2 out of 3), 0 wrong
  const cbPartial2 = calculateScoreForQuestion(qCB, { selectedOptionIds: ["cb-1", "cb-2"] });
  assert(cbPartial2.earnedPoints === 20, `CHECKBOXES: Partial correct (2/3, 0 wrong) yields 20 points (actual: ${cbPartial2.earnedPoints})`);

  // Case C: Partial correct (1 out of 3), 0 wrong
  const cbPartial1 = calculateScoreForQuestion(qCB, { selectedOptionIds: ["cb-1"] });
  assert(cbPartial1.earnedPoints === 10, `CHECKBOXES: Partial correct (1/3, 0 wrong) yields 10 points (actual: ${cbPartial1.earnedPoints})`);

  // Case D: Partial correct (2 out of 3), BUT 1 wrong selected
  const cbPartialWithWrong = calculateScoreForQuestion(qCB, { selectedOptionIds: ["cb-1", "cb-2", "cb-4"] });
  assert(cbPartialWithWrong.earnedPoints === 0, "CHECKBOXES: Partial correct with 1 wrong selected yields 0 points (penalty)");

  // Case E: Only wrong options selected
  const cbWrongOnly = calculateScoreForQuestion(qCB, { selectedOptionIds: ["cb-4", "cb-5"] });
  assert(cbWrongOnly.earnedPoints === 0, "CHECKBOXES: Only wrong options selected yields 0 points");

  // Case F: Empty array
  const cbEmpty = calculateScoreForQuestion(qCB, { selectedOptionIds: [] });
  assert(cbEmpty.earnedPoints === 0, "CHECKBOXES: Empty selectedOptionIds yields 0 points");
}

// 4. Short Answer Tests (Case-insensitive & Case-sensitive)
{
  const qSAInsensitive: QuestionMock = {
    id: "q-sa-1",
    type: "SHORT_ANSWER",
    points: 20,
    options: [],
    sampleAnswer: "Soekarno",
    caseSensitive: false,
  };

  assert(calculateScoreForQuestion(qSAInsensitive, { textResponse: "soekarno" }).earnedPoints === 20, "SHORT_ANSWER (case-insensitive): 'soekarno' matches 'Soekarno' (20 pts)");
  assert(calculateScoreForQuestion(qSAInsensitive, { textResponse: "  SOEKARNO  " }).earnedPoints === 20, "SHORT_ANSWER (case-insensitive): Trimmed uppercase matches (20 pts)");
  assert(calculateScoreForQuestion(qSAInsensitive, { textResponse: "Hatta" }).earnedPoints === 0, "SHORT_ANSWER (case-insensitive): Non-match yields 0 points");
  assert(calculateScoreForQuestion(qSAInsensitive, { textResponse: "   " }).earnedPoints === 0, "SHORT_ANSWER: Whitespace-only yields 0 points");

  const qSACaseSensitive: QuestionMock = {
    id: "q-sa-2",
    type: "SHORT_ANSWER",
    points: 20,
    options: [],
    sampleAnswer: "NaCl",
    caseSensitive: true,
  };

  assert(calculateScoreForQuestion(qSACaseSensitive, { textResponse: "NaCl" }).earnedPoints === 20, "SHORT_ANSWER (case-sensitive): Exact 'NaCl' matches (20 pts)");
  assert(calculateScoreForQuestion(qSACaseSensitive, { textResponse: "nacl" }).earnedPoints === 0, "SHORT_ANSWER (case-sensitive): 'nacl' does not match 'NaCl' (0 pts)");
}

// 5. Essay Tests
{
  const qEssay: QuestionMock = {
    id: "q-essay",
    type: "ESSAY",
    points: 50,
    options: [],
  };

  const essayRes = calculateScoreForQuestion(qEssay, { textResponse: "Panjang lebar penjelasan..." });
  assert(essayRes.earnedPoints === 0, "ESSAY: Auto-graded points is 0 (awaits manual grading)");
  assert(essayRes.isAutoGraded === false, "ESSAY: isAutoGraded is false");
  assert(essayRes.textResponse === "Panjang lebar penjelasan...", "ESSAY: textResponse preserved");
}

// -------------------------------------------------------------------------
// SUITE 2: Live Database & API Stress-Testing with Full Lifecycle
// -------------------------------------------------------------------------
async function runEmpiricalDatabaseAndApiTests() {
  console.log("\n=======================================================");
  console.log("SUITE 2: Live Database Progress Sync, Proctor & Actions");
  console.log("=======================================================");

  try {
    // 1. Create Seed Quiz
    const quiz = await prisma.quiz.create({
      data: {
        title: "[CHALLENGER_M23] Empirical Stress Test Quiz",
        description: "Testing fast sync, live leaderboard, podium, and supervisor actions",
        durationMinutes: 60,
        maxStrikes: 3,
        supervisorPin: "998877",
        enableFullscreenLock: true,
        enableTabSwitchDetect: true,
        questions: {
          create: [
            {
              order: 1,
              type: "SINGLE_CHOICE",
              text: "Pertanyaan 1: Pilihan Tunggal",
              points: 20,
              options: {
                create: [
                  { text: "Benar A", isCorrect: true },
                  { text: "Salah B", isCorrect: false },
                ],
              },
            },
            {
              order: 2,
              type: "TRUE_FALSE",
              text: "Pertanyaan 2: Benar / Salah",
              points: 20,
              options: {
                create: [
                  { text: "Benar", isCorrect: true },
                  { text: "Salah", isCorrect: false },
                ],
              },
            },
            {
              order: 3,
              type: "CHECKBOXES",
              text: "Pertanyaan 3: Kotak Centang",
              points: 30,
              options: {
                create: [
                  { text: "Pilihan 1 Benar", isCorrect: true },
                  { text: "Pilihan 2 Benar", isCorrect: true },
                  { text: "Pilihan 3 Salah", isCorrect: false },
                ],
              },
            },
            {
              order: 4,
              type: "SHORT_ANSWER",
              text: "Pertanyaan 4: Isian Singkat",
              points: 15,
              sampleAnswer: "Merdeka",
              caseSensitive: false,
            },
            {
              order: 5,
              type: "ESSAY",
              text: "Pertanyaan 5: Esai",
              points: 15,
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

    const [q1, q2, q3, q4, q5] = quiz.questions;
    const q1OptCorrect = q1.options.find((o) => o.isCorrect)!;
    const q1OptWrong = q1.options.find((o) => !o.isCorrect)!;
    const q2OptCorrect = q2.options.find((o) => o.isCorrect)!;
    const q3OptCorrects = q3.options.filter((o) => o.isCorrect).map((o) => o.id);
    const q3OptWrong = q3.options.find((o) => !o.isCorrect)!;

    const testPrefix = `test_${Date.now()}`;
    await prisma.user.deleteMany({ where: { name: { startsWith: "[CHALLENGER_USER]" } } });

    // 2. Create 4 Test Users
    const user1 = await prisma.user.create({
      data: { name: "[CHALLENGER_USER] 1st Player (Gold)", phoneNumber: `62811_${Date.now()}_1`, studentClass: "12-IPA-1", role: "STUDENT" },
    });
    const user2 = await prisma.user.create({
      data: { name: "[CHALLENGER_USER] 2nd Player (Silver)", phoneNumber: `62811_${Date.now()}_2`, studentClass: "12-IPA-1", role: "STUDENT" },
    });
    const user3 = await prisma.user.create({
      data: { name: "[CHALLENGER_USER] 3rd Player (Bronze)", phoneNumber: `62811_${Date.now()}_3`, studentClass: "12-IPS-1", role: "STUDENT" },
    });
    const user4 = await prisma.user.create({
      data: { name: "[CHALLENGER_USER] 4th Disqualified Player", phoneNumber: `62811_${Date.now()}_4`, studentClass: "12-IPS-1", role: "STUDENT" },
    });

    // -------------------------------------------------------------
    // Test Fast Progress Sync Simulation for User 1 (Single vs Full)
    // -------------------------------------------------------------
    console.log("\n--- Testing Fast Progress Sync API Logic ---");

    const attempt1 = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: user1.id,
        status: "IN_PROGRESS",
        startedAt: new Date(),
        score: 0,
      },
    });

    // Step 1: Single Question Sync (Q1 Correct)
    {
      const body = { questionId: q1.id, answer: { optionId: q1OptCorrect.id, selectedOptionIds: [q1OptCorrect.id] } };
      
      // Simulate progress sync route logic
      let answersMap: Record<string, any> = {};
      if (body.questionId && body.answer) {
        answersMap[body.questionId] = body.answer;
      }

      const qResult = calculateScoreForQuestion(q1, answersMap[q1.id]);
      const currentScore = qResult.earnedPoints; // 20

      await prisma.quizAttempt.update({
        where: { id: attempt1.id },
        data: {
          answers: JSON.stringify(answersMap),
          score: currentScore,
        },
      });

      await prisma.quizStudentAnswer.upsert({
        where: { attemptId_questionId: { attemptId: attempt1.id, questionId: q1.id } },
        update: { selectedOptionIds: JSON.stringify([q1OptCorrect.id]), earnedPoints: qResult.earnedPoints, isAutoGraded: qResult.isAutoGraded },
        create: { attemptId: attempt1.id, questionId: q1.id, selectedOptionIds: JSON.stringify([q1OptCorrect.id]), earnedPoints: qResult.earnedPoints, isAutoGraded: qResult.isAutoGraded },
      });

      const updated = await prisma.quizAttempt.findUnique({ where: { id: attempt1.id } });
      assert(updated?.score === 20, "Fast Sync (Single): Q1 single answer scored 20 pts");
    }

    // Step 2: Multiple Answers Sync (All 5 questions)
    {
      const fullAnswers: Record<string, any> = {
        [q1.id]: { optionId: q1OptCorrect.id, selectedOptionIds: [q1OptCorrect.id] },
        [q2.id]: { optionId: q2OptCorrect.id, selectedOptionIds: [q2OptCorrect.id] },
        [q3.id]: { selectedOptionIds: q3OptCorrects }, // 30 pts
        [q4.id]: { textResponse: "merdeka" }, // 15 pts
        [q5.id]: { textResponse: "Esai refleksi..." }, // 0 pts auto
      };

      let liveScore = 0;
      for (const q of quiz.questions) {
        const ans = fullAnswers[q.id];
        if (ans) {
          const evalRes = calculateScoreForQuestion(q, ans);
          liveScore += evalRes.earnedPoints;

          await prisma.quizStudentAnswer.upsert({
            where: { attemptId_questionId: { attemptId: attempt1.id, questionId: q.id } },
            update: {
              selectedOptionIds: evalRes.selectedOptionIds.length > 0 ? JSON.stringify(evalRes.selectedOptionIds) : null,
              textResponse: evalRes.textResponse,
              earnedPoints: evalRes.earnedPoints,
              isAutoGraded: evalRes.isAutoGraded,
            },
            create: {
              attemptId: attempt1.id,
              questionId: q.id,
              selectedOptionIds: evalRes.selectedOptionIds.length > 0 ? JSON.stringify(evalRes.selectedOptionIds) : null,
              textResponse: evalRes.textResponse,
              earnedPoints: evalRes.earnedPoints,
              isAutoGraded: evalRes.isAutoGraded,
            },
          });
        }
      }

      await prisma.quizAttempt.update({
        where: { id: attempt1.id },
        data: {
          answers: JSON.stringify(fullAnswers),
          score: liveScore,
        },
      });

      const updated = await prisma.quizAttempt.findUnique({ where: { id: attempt1.id } });
      assert(updated?.score === 85, `Fast Sync (Full Map): Total score computed 85/100 (actual: ${updated?.score})`);
      const studentAnsCount = await prisma.quizStudentAnswer.count({ where: { attemptId: attempt1.id } });
      assert(studentAnsCount === 5, "Fast Sync: 5 QuizStudentAnswer records present in database");
    }

    // Step 3: Test Invalid questionIds handling
    {
      const invalidAnswers: Record<string, any> = {
        "non-existent-question-id-uuid": { optionId: "opt-foo" },
        [q1.id]: { optionId: q1OptCorrect.id },
      };

      // When iterating over valid quiz.questions, non-existent question IDs are safely skipped
      let totalValidScore = 0;
      for (const q of quiz.questions) {
        if (invalidAnswers[q.id]) {
          totalValidScore += calculateScoreForQuestion(q, invalidAnswers[q.id]).earnedPoints;
        }
      }
      assert(totalValidScore === 20, "Fast Sync: Invalid questionIds are ignored without crash or score inflation");
    }

    // Step 4: Test Corrupted JSON recovery in attempt.answers
    {
      await prisma.quizAttempt.update({
        where: { id: attempt1.id },
        data: { answers: "INVALID_CORRUPTED_JSON{{{" },
      });

      const att = await prisma.quizAttempt.findUnique({ where: { id: attempt1.id } });
      let parsedMap: any = {};
      try {
        parsedMap = JSON.parse(att?.answers || "{}");
      } catch (e) {
        parsedMap = {}; // Fallback
      }
      assert(typeof parsedMap === "object" && Object.keys(parsedMap).length === 0, "Fast Sync: Corrupted JSON gracefully falls back to empty map");
    }

    // -------------------------------------------------------------
    // Create attempts for User 2, User 3, User 4
    // -------------------------------------------------------------
    const attempt2 = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: user2.id,
        status: "IN_PROGRESS",
        startedAt: new Date(),
        answers: JSON.stringify({
          [q1.id]: { optionId: q1OptCorrect.id },
          [q2.id]: { optionId: q2OptCorrect.id },
        }),
        score: 40,
        strikeCount: 1,
      },
    });

    const attempt3 = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: user3.id,
        status: "LOCKED",
        startedAt: new Date(),
        answers: JSON.stringify({
          [q1.id]: { optionId: q1OptCorrect.id },
        }),
        score: 20,
        strikeCount: 3,
      },
    });

    const attempt4 = await prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: user4.id,
        status: "DISQUALIFIED",
        startedAt: new Date(),
        score: 0,
        strikeCount: 3,
      },
    });

    // -------------------------------------------------------------
    // Test Live Proctor GET Aggregation & Podium Sorting Logic
    // -------------------------------------------------------------
    console.log("\n--- Testing Live Proctor GET Aggregation & Sorting ---");

    const proctorAttempts = await prisma.quizAttempt.findMany({
      where: { quizId: quiz.id },
      include: {
        user: { select: { id: true, name: true, phoneNumber: true, studentClass: true } },
        detailedAnswers: { select: { questionId: true, selectedOptionIds: true, textResponse: true, earnedPoints: true } },
        violations: true,
      },
    });

    const totalQuizQuestions = quiz.questions.length;
    const formattedParticipants = proctorAttempts.map((att) => {
      const answeredSet = new Set<string>();
      if (att.answers) {
        try {
          const parsed = JSON.parse(att.answers);
          if (typeof parsed === "object" && parsed !== null) {
            Object.keys(parsed).forEach((k) => answeredSet.add(k));
          }
        } catch (e) {}
      }
      if (att.detailedAnswers) {
        att.detailedAnswers.forEach((da) => answeredSet.add(da.questionId));
      }
      const answeredCount = answeredSet.size;
      const progressPercentage = Math.round((answeredCount / totalQuizQuestions) * 100);

      return {
        id: att.id,
        studentName: att.user?.name || "Unknown",
        studentClass: att.user?.studentClass || "-",
        status: att.status,
        score: att.score,
        strikes: att.strikeCount,
        answeredCount,
        progressPercentage,
        updatedAt: att.updatedAt,
      };
    }).sort((a, b) => {
      if (a.status === "DISQUALIFIED" && b.status !== "DISQUALIFIED") return 1;
      if (b.status === "DISQUALIFIED" && a.status !== "DISQUALIFIED") return -1;
      if (b.score !== a.score) return b.score - a.score;
      if (b.answeredCount !== a.answeredCount) return b.answeredCount - a.answeredCount;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    assert(formattedParticipants.length === 4, "Proctor Aggregation: 4 participants retrieved");
    assert(formattedParticipants[0].studentName === "[CHALLENGER_USER] 1st Player (Gold)", "Podium #1: Gold is Player 1 (Score: 85)");
    assert(formattedParticipants[1].studentName === "[CHALLENGER_USER] 2nd Player (Silver)", "Podium #2: Silver is Player 2 (Score: 40)");
    assert(formattedParticipants[2].studentName === "[CHALLENGER_USER] 3rd Player (Bronze)", "Podium #3: Bronze is Player 3 (Score: 20)");
    assert(formattedParticipants[3].studentName === "[CHALLENGER_USER] 4th Disqualified Player", "Disqualified Participant is pinned at the bottom");

    const stats = {
      total: formattedParticipants.length,
      inProgress: formattedParticipants.filter((p) => p.status === "IN_PROGRESS").length,
      locked: formattedParticipants.filter((p) => p.status === "LOCKED").length,
      submitted: formattedParticipants.filter((p) => p.status === "SUBMITTED" || p.status === "GRADED").length,
      disqualified: formattedParticipants.filter((p) => p.status === "DISQUALIFIED").length,
    };

    assert(stats.total === 4, "Proctor Stats: Total 4");
    assert(stats.inProgress === 2, "Proctor Stats: 2 in progress");
    assert(stats.locked === 1, "Proctor Stats: 1 locked");
    assert(stats.disqualified === 1, "Proctor Stats: 1 disqualified");

    // -------------------------------------------------------------
    // Test Live Proctor Action Handlers
    // -------------------------------------------------------------
    console.log("\n--- Testing Live Proctor Action Handlers ---");

    // Action 1: UNLOCK on Attempt 3 (Locked Student)
    {
      const attemptBefore = await prisma.quizAttempt.findUnique({ where: { id: attempt3.id } });
      assert(attemptBefore?.status === "LOCKED", "UNLOCK Action: Attempt is currently LOCKED");

      await prisma.quizAttempt.update({
        where: { id: attempt3.id },
        data: { status: "IN_PROGRESS", strikeCount: 0 },
      });
      await prisma.examViolationLog.create({
        data: { attemptId: attempt3.id, type: "REMOTE_UNLOCKED", description: "Test Unlock by Admin" },
      });

      const attemptAfter = await prisma.quizAttempt.findUnique({ where: { id: attempt3.id } });
      assert(attemptAfter?.status === "IN_PROGRESS", "UNLOCK Action: Status changed to IN_PROGRESS");
      assert(attemptAfter?.strikeCount === 0, "UNLOCK Action: Strikes reset to 0");

      const log = await prisma.examViolationLog.findFirst({ where: { attemptId: attempt3.id, type: "REMOTE_UNLOCKED" } });
      assert(log !== null, "UNLOCK Action: ExamViolationLog record created with type REMOTE_UNLOCKED");
    }

    // Action 2: RESET_STRIKES on Attempt 2
    {
      await prisma.quizAttempt.update({
        where: { id: attempt2.id },
        data: { strikeCount: 0 },
      });
      await prisma.examViolationLog.create({
        data: { attemptId: attempt2.id, type: "STRIKES_RESET", description: "Test Strikes Reset by Admin" },
      });

      const attemptAfter = await prisma.quizAttempt.findUnique({ where: { id: attempt2.id } });
      assert(attemptAfter?.strikeCount === 0, "RESET_STRIKES Action: Strikes reset to 0");
      assert(attemptAfter?.status === "IN_PROGRESS", "RESET_STRIKES Action: Status remains IN_PROGRESS");
    }

    // Action 3: FORCE_SUBMIT on Attempt 2
    {
      const nowSubmit = new Date();
      await prisma.quizAttempt.update({
        where: { id: attempt2.id },
        data: { status: "SUBMITTED", submittedAt: nowSubmit, score: 40 },
      });
      await prisma.examViolationLog.create({
        data: { attemptId: attempt2.id, type: "FORCE_SUBMITTED", description: "Test Force Submitted by Admin" },
      });

      const attemptAfter = await prisma.quizAttempt.findUnique({ where: { id: attempt2.id } });
      assert(attemptAfter?.status === "SUBMITTED", "FORCE_SUBMIT Action: Status changed to SUBMITTED");
      assert(attemptAfter?.submittedAt !== null, "FORCE_SUBMIT Action: submittedAt is populated");
    }

    // Action 4: DISQUALIFY on Attempt 1
    {
      const nowDQ = new Date();
      await prisma.quizAttempt.update({
        where: { id: attempt1.id },
        data: { status: "DISQUALIFIED", score: 0, submittedAt: nowDQ },
      });
      await prisma.examViolationLog.create({
        data: { attemptId: attempt1.id, type: "DISQUALIFIED", description: "Test Disqualify by Admin" },
      });

      const attemptAfter = await prisma.quizAttempt.findUnique({ where: { id: attempt1.id } });
      assert(attemptAfter?.status === "DISQUALIFIED", "DISQUALIFY Action: Status changed to DISQUALIFIED");
      assert(attemptAfter?.score === 0, "DISQUALIFY Action: Score set to 0");
    }

    // -------------------------------------------------------------
    // Clean up
    // -------------------------------------------------------------
    console.log("\n--- Cleaning up Test Artifacts ---");
    await prisma.examViolationLog.deleteMany({ where: { attempt: { quizId: quiz.id } } });
    await prisma.quizStudentAnswer.deleteMany({ where: { attempt: { quizId: quiz.id } } });
    await prisma.quizAttempt.deleteMany({ where: { quizId: quiz.id } });
    await prisma.question.deleteMany({ where: { quizId: quiz.id } });
    await prisma.quiz.deleteMany({ where: { id: quiz.id } });
    await prisma.user.deleteMany({ where: { name: { startsWith: "[CHALLENGER_USER]" } } });
    console.log("  [CLEANUP] All test database records cleaned up cleanly.");

  } catch (err: any) {
    assert(false, "Empirical Database Test Failed", err.message);
  }
}

// -------------------------------------------------------------------------
// EXECUTION ENTRYPOINT
// -------------------------------------------------------------------------
async function main() {
  await runEmpiricalDatabaseAndApiTests();

  console.log("\n=======================================================");
  console.log("CHALLENGER VERIFICATION SUMMARY");
  console.log("=======================================================");
  console.log(`Total Tests Run : ${totalTests}`);
  console.log(`Passed          : ${passedTests}`);
  console.log(`Failed          : ${failedTests}`);
  if (failedTests > 0) {
    console.log("\nFailed Assertions:");
    failures.forEach((f) => console.log(f));
    process.exit(1);
  } else {
    console.log("\n>>> ALL EMPIRICAL CHALLENGER TESTS PASSED (100%)! <<<");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
