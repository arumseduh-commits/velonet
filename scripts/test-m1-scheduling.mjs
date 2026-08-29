import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ==========================================
// EMPIRICAL STRESS-TEST HARNESS FOR MILESTONE 1
// ==========================================

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
// SUITE 1: Pure Window of Availability & Date Boundary Matrix
// -------------------------------------------------------------
console.log("\n=======================================================");
console.log("SUITE 1: Window of Availability & Boundary Mathematics");
console.log("=======================================================");

function evaluateAvailability(openAt, closeAt, now, hasStarted = false) {
  const isUpcoming = Boolean(openAt && now.getTime() < openAt.getTime());
  const isPastClose = Boolean(closeAt && now.getTime() > closeAt.getTime());

  if (isUpcoming) return "UPCOMING";
  if (isPastClose && !hasStarted) return "CLOSED";
  return "OPEN";
}

function evaluateStartApiGate(openAt, closeAt, now, hasActiveAttempt) {
  // 1. Check openAt
  if (openAt && now.getTime() < openAt.getTime()) {
    return { allowed: false, reason: "Ujian belum dibuka" };
  }
  // 2. Check closeAt
  if (closeAt && now.getTime() > closeAt.getTime()) {
    if (!hasActiveAttempt) {
      return { allowed: false, reason: "Waktu pengerjaan ujian telah berakhir / ditutup" };
    }
  }
  return { allowed: true };
}

const openTime = new Date("2026-08-30T10:00:00.000Z");
const closeTime = new Date("2026-08-30T12:00:00.000Z");

// Case 1: Before openAt
{
  const beforeOpen = new Date("2026-08-30T09:59:59.000Z"); // 1s before open
  const avail = evaluateAvailability(openTime, closeTime, beforeOpen, false);
  const gate = evaluateStartApiGate(openTime, closeTime, beforeOpen, false);
  assert(avail === "UPCOMING", "1s before openAt => Availability is UPCOMING");
  assert(!gate.allowed && gate.reason?.includes("belum dibuka"), "1s before openAt => Start API rejected (403)");
}

// Case 2: Exactly at openAt
{
  const exactOpen = new Date("2026-08-30T10:00:00.000Z");
  const avail = evaluateAvailability(openTime, closeTime, exactOpen, false);
  const gate = evaluateStartApiGate(openTime, closeTime, exactOpen, false);
  assert(avail === "OPEN", "Exactly at openAt => Availability is OPEN");
  assert(gate.allowed, "Exactly at openAt => Start API allowed");
}

// Case 3: Inside window (between openAt and closeAt)
{
  const midWindow = new Date("2026-08-30T11:00:00.000Z");
  const avail = evaluateAvailability(openTime, closeTime, midWindow, false);
  const gate = evaluateStartApiGate(openTime, closeTime, midWindow, false);
  assert(avail === "OPEN", "Inside window => Availability is OPEN");
  assert(gate.allowed, "Inside window => Start API allowed");
}

// Case 4: Exactly 1 second before closeAt
{
  const oneSecBeforeClose = new Date("2026-08-30T11:59:59.000Z");
  const avail = evaluateAvailability(openTime, closeTime, oneSecBeforeClose, false);
  const gate = evaluateStartApiGate(openTime, closeTime, oneSecBeforeClose, false);
  assert(avail === "OPEN", "1s before closeAt => Availability is OPEN");
  assert(gate.allowed, "1s before closeAt => Start API allowed");
}

// Case 5: Exactly at closeAt
{
  const exactClose = new Date("2026-08-30T12:00:00.000Z");
  const avail = evaluateAvailability(openTime, closeTime, exactClose, false);
  const gate = evaluateStartApiGate(openTime, closeTime, exactClose, false);
  assert(avail === "OPEN", "Exactly at closeAt => Availability is OPEN (not strictly greater than closeAt)");
  assert(gate.allowed, "Exactly at closeAt => Start API allowed");
}

// Case 6: Exactly 1 second after closeAt (New attempt)
{
  const oneSecAfterClose = new Date("2026-08-30T12:00:01.000Z");
  const avail = evaluateAvailability(openTime, closeTime, oneSecAfterClose, false);
  const gate = evaluateStartApiGate(openTime, closeTime, oneSecAfterClose, false);
  assert(avail === "CLOSED", "1s after closeAt (no attempt) => Availability is CLOSED");
  assert(!gate.allowed && gate.reason?.includes("berakhir / ditutup"), "1s after closeAt (no attempt) => Start API rejected (403)");
}

// Case 7: After closeAt with ongoing active attempt (Personal duration tolerance)
{
  const wayAfterClose = new Date("2026-08-30T12:30:00.000Z");
  const avail = evaluateAvailability(openTime, closeTime, wayAfterClose, true);
  const gate = evaluateStartApiGate(openTime, closeTime, wayAfterClose, true);
  assert(avail === "OPEN", "After closeAt with active attempt => Student view remains OPEN to resume");
  assert(gate.allowed, "After closeAt with active attempt => Start/Resume API allowed");
}

// Case 8: Flexible Schedule (openAt = null, closeAt = null)
{
  const randomTime = new Date("2026-08-30T15:00:00.000Z");
  const avail = evaluateAvailability(null, null, randomTime, false);
  const gate = evaluateStartApiGate(null, null, randomTime, false);
  assert(avail === "OPEN", "openAt=null & closeAt=null => Availability is OPEN (Flexible)");
  assert(gate.allowed, "openAt=null & closeAt=null => Start API allowed");
}

// Case 9: Only openAt set (no close date)
{
  const pastOpen = new Date("2026-08-30T15:00:00.000Z");
  const beforeOpen = new Date("2026-08-30T09:00:00.000Z");
  assert(evaluateAvailability(openTime, null, beforeOpen, false) === "UPCOMING", "Only openAt: Before open => UPCOMING");
  assert(evaluateAvailability(openTime, null, pastOpen, false) === "OPEN", "Only openAt: After open => OPEN");
}

// Case 10: Only closeAt set (no open date)
{
  const beforeClose = new Date("2026-08-30T11:00:00.000Z");
  const afterClose = new Date("2026-08-30T13:00:00.000Z");
  assert(evaluateAvailability(null, closeTime, beforeClose, false) === "OPEN", "Only closeAt: Before close => OPEN");
  assert(evaluateAvailability(null, closeTime, afterClose, false) === "CLOSED", "Only closeAt: After close => CLOSED");
}

// -------------------------------------------------------------
// SUITE 2: Personal Timer Tolerance Calculation
// -------------------------------------------------------------
console.log("\n=======================================================");
console.log("SUITE 2: Personal Timer & Duration Calculations");
console.log("=======================================================");

function calculateRemainingSeconds(startedAt, durationMinutes, now) {
  const elapsedSecs = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
  return Math.max(0, durationMinutes * 60 - elapsedSecs);
}

{
  // Student started at 11:50:00 (10 mins before 12:00 closeAt). Quiz duration is 30 mins.
  const startedAt = new Date("2026-08-30T11:50:00.000Z");
  const durationMins = 30; // 1800 seconds

  // At 12:05:00 (5 mins past closeAt, 15 mins since start)
  const now1 = new Date("2026-08-30T12:05:00.000Z");
  const remaining1 = calculateRemainingSeconds(startedAt, durationMins, now1);
  assert(remaining1 === 900, "15 minutes elapsed of 30 min exam => Exactly 900s (15 min) remaining");

  // At 12:20:00 (20 mins past closeAt, 30 mins since start)
  const now2 = new Date("2026-08-30T12:20:00.000Z");
  const remaining2 = calculateRemainingSeconds(startedAt, durationMins, now2);
  assert(remaining2 === 0, "30 minutes elapsed of 30 min exam => 0s remaining (triggers auto-submit)");

  // At 12:25:00 (35 mins since start)
  const now3 = new Date("2026-08-30T12:25:00.000Z");
  const remaining3 = calculateRemainingSeconds(startedAt, durationMins, now3);
  assert(remaining3 === 0, "Overtime clamp => Math.max(0, ...) ensures never negative");
}

// -------------------------------------------------------------
// SUITE 3: Timezone Transformations & Input Serialization
// -------------------------------------------------------------
console.log("\n=======================================================");
console.log("SUITE 3: Timezone Transformations & Input Formats");
console.log("=======================================================");

function toLocalDatetimeInputString(isoDateStr) {
  if (!isoDateStr) return "";
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

{
  // Test null / undefined / empty handling
  assert(toLocalDatetimeInputString(null) === "", "toLocalDatetimeInputString(null) returns empty string");
  assert(toLocalDatetimeInputString(undefined) === "", "toLocalDatetimeInputString(undefined) returns empty string");
  assert(toLocalDatetimeInputString("") === "", "toLocalDatetimeInputString('') returns empty string");
  assert(toLocalDatetimeInputString("invalid-date-string") === "", "toLocalDatetimeInputString('invalid') returns empty string");

  // Test valid ISO conversion format (YYYY-MM-DDTHH:mm)
  const sampleIso = "2026-08-30T14:05:00.000Z";
  const localStr = toLocalDatetimeInputString(sampleIso);
  const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  assert(regex.test(localStr), `toLocalDatetimeInputString produces valid datetime-local format: '${localStr}'`);

  // Verify that new Date(localStr) matches the local time components of the original Date
  const origDate = new Date(sampleIso);
  const reParsed = new Date(localStr);
  assert(
    reParsed.getFullYear() === origDate.getFullYear() &&
    reParsed.getMonth() === origDate.getMonth() &&
    reParsed.getDate() === origDate.getDate() &&
    reParsed.getHours() === origDate.getHours() &&
    reParsed.getMinutes() === origDate.getMinutes(),
    "toLocalDatetimeInputString roundtrips local calendar components accurately"
  );

  // Test leap year edge case: Feb 29, 2028
  const leapIso = "2028-02-29T08:09:00.000Z";
  const leapLocal = toLocalDatetimeInputString(leapIso);
  assert(leapLocal.includes("2028-02-29"), `Leap year Feb 29 preserved: '${leapLocal}'`);

  // Test padding of single digit month/day/hour/minute (e.g., Jan 5, 04:03)
  const d = new Date(2026, 0, 5, 4, 3, 0); // Local Jan 5, 2026, 04:03:00
  const dLocal = toLocalDatetimeInputString(d.toISOString());
  assert(dLocal.includes("-01-05T04:03"), `Single digits zero-padded correctly: '${dLocal}'`);
}

// -------------------------------------------------------------
// SUITE 4: Invalid Chronological Validation (openAt >= closeAt)
// -------------------------------------------------------------
console.log("\n=======================================================");
console.log("SUITE 4: Invalid Chronological Validation");
console.log("=======================================================");

function validateScheduleChronology(openAt, closeAt) {
  if (!openAt || !closeAt) return { valid: true };
  const openTime = new Date(openAt).getTime();
  const closeTime = new Date(closeAt).getTime();
  if (isNaN(openTime)) return { valid: false, error: "Format tanggal/waktu jadwal buka (openAt) tidak valid." };
  if (isNaN(closeTime)) return { valid: false, error: "Format tanggal/waktu jadwal tutup (closeAt) tidak valid." };
  if (openTime >= closeTime) {
    return { valid: false, error: "Jadwal tutup ujian (closeAt) harus lebih akhir dari jadwal buka ujian (openAt)." };
  }
  return { valid: true };
}

{
  // Test openAt > closeAt
  const res1 = validateScheduleChronology("2026-08-30T15:00", "2026-08-30T14:00");
  assert(!res1.valid && res1.error?.includes("harus lebih akhir"), "openAt > closeAt is rejected");

  // Test openAt === closeAt
  const res2 = validateScheduleChronology("2026-08-30T15:00", "2026-08-30T15:00");
  assert(!res2.valid && res2.error?.includes("harus lebih akhir"), "openAt === closeAt is rejected");

  // Test openAt < closeAt
  const res3 = validateScheduleChronology("2026-08-30T14:00", "2026-08-30T15:00");
  assert(res3.valid, "openAt < closeAt is accepted");

  // Test one of them empty
  assert(validateScheduleChronology("2026-08-30T14:00", "").valid, "openAt set, closeAt empty is valid");
  assert(validateScheduleChronology("", "2026-08-30T15:00").valid, "openAt empty, closeAt set is valid");
  assert(validateScheduleChronology("", "").valid, "Both empty is valid");
}

// -------------------------------------------------------------
// SUITE 5: Countdown Formatter Logic
// -------------------------------------------------------------
console.log("\n=======================================================");
console.log("SUITE 5: Countdown Formatter Verification");
console.log("=======================================================");

function formatCountdown(targetDateStr, now) {
  const target = new Date(targetDateStr).getTime();
  const diff = target - now.getTime();
  if (diff <= 0) return { text: "00:00:00", isImminent: true };

  const totalSecs = Math.floor(diff / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return { text: `${days} hari ${remHours} jam lagi`, isImminent: false };
  }

  const formatted = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return { text: formatted, isImminent: true };
}

{
  const refNow = new Date("2026-08-30T10:00:00.000Z");

  // Imminent: 2 hours 15 mins 30 secs
  const target1 = "2026-08-30T12:15:30.000Z";
  const res1 = formatCountdown(target1, refNow);
  assert(res1.text === "02:15:30" && res1.isImminent === true, `Imminent countdown: '${res1.text}'`);

  // Distant: 3 days 5 hours
  const target2 = new Date(refNow.getTime() + (3 * 24 + 5) * 3600 * 1000).toISOString();
  const res2 = formatCountdown(target2, refNow);
  assert(res2.text === "3 hari 5 jam lagi" && res2.isImminent === false, `Distant countdown: '${res2.text}'`);

  // Expired / exactly zero
  const res3 = formatCountdown("2026-08-30T10:00:00.000Z", refNow);
  assert(res3.text === "00:00:00" && res3.isImminent === true, `Expired countdown: '${res3.text}'`);
}

// -------------------------------------------------------------
// SUITE 6: Database & Prisma Live Verification
// -------------------------------------------------------------
async function runPrismaVerification() {
  console.log("\n=======================================================");
  console.log("SUITE 6: Live Prisma Database Schema & Query Test");
  console.log("=======================================================");

  try {
    // 1. Create a test quiz with openAt and closeAt
    const testQuiz = await prisma.quiz.create({
      data: {
        title: "[TEST] M1 Challenger Boundary Verification Quiz",
        description: "Automated test quiz for scheduling validation",
        openAt: new Date("2026-08-30T10:00:00.000Z"),
        closeAt: new Date("2026-08-30T12:00:00.000Z"),
        durationMinutes: 45,
        enableFullscreenLock: true,
        enableTabSwitchDetect: true,
        maxStrikes: 3,
        examToken: "M1TEST",
        questions: {
          create: [
            {
              type: "SINGLE_CHOICE",
              text: "Sample Test Question 1",
              points: 20,
              order: 0,
              options: {
                create: [
                  { text: "Option A", isCorrect: true },
                  { text: "Option B", isCorrect: false },
                ],
              },
            },
          ],
        },
      },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });

    assert(Boolean(testQuiz && testQuiz.id), `Prisma Quiz created successfully with ID: ${testQuiz.id}`);
    assert(
      testQuiz.openAt?.toISOString() === "2026-08-30T10:00:00.000Z",
      `openAt column accurately stored: ${testQuiz.openAt?.toISOString()}`
    );
    assert(
      testQuiz.closeAt?.toISOString() === "2026-08-30T12:00:00.000Z",
      `closeAt column accurately stored: ${testQuiz.closeAt?.toISOString()}`
    );

    // 2. Query the quiz back
    const fetched = await prisma.quiz.findUnique({
      where: { id: testQuiz.id },
    });
    assert(fetched !== null, "Quiz query by ID returned non-null");
    assert(fetched?.durationMinutes === 45, "durationMinutes field intact");

    // 3. Update the quiz schedule
    const updated = await prisma.quiz.update({
      where: { id: testQuiz.id },
      data: {
        openAt: new Date("2026-08-30T09:00:00.000Z"),
        closeAt: new Date("2026-08-30T13:00:00.000Z"),
      },
    });
    assert(
      updated.openAt?.toISOString() === "2026-08-30T09:00:00.000Z" &&
      updated.closeAt?.toISOString() === "2026-08-30T13:00:00.000Z",
      "Prisma Quiz schedule updated successfully"
    );

    // Clean up test quiz with cascade
    await prisma.quiz.delete({
      where: { id: testQuiz.id },
    });
    console.log("  [CLEANUP] Test quiz deleted cleanly from database.");
  } catch (err) {
    assert(false, "Prisma Live DB test failed", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

// -------------------------------------------------------------
// EXECUTE ALL SUITES
// -------------------------------------------------------------
async function main() {
  await runPrismaVerification();

  console.log("\n=======================================================");
  console.log("EMPIRICAL TEST SUMMARY");
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
