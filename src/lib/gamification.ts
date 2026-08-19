import { prisma } from "./prisma";

/**
 * Awards XP to a user and handles leveling up.
 *
 * @param userId - The ID of the user receiving XP
 * @param amount - The amount of XP to award
 * @param reason - The reason for awarding XP
 * @returns The updated GamificationProfile
 */
export async function awardXP(userId: string, amount: number, reason: string) {
  // Try to find the user's gamification profile
  let profile = await prisma.gamificationProfile.findUnique({
    where: { userId },
  });

  // If it doesn't exist, create it
  if (!profile) {
    profile = await prisma.gamificationProfile.create({
      data: {
        userId,
        xp: 0,
        level: 1,
      },
    });
  }

  // Calculate new XP and Level
  // Assuming 100 XP per level. Level = Math.floor(totalXP / 100) + 1
  const newXP = profile.xp + amount;
  const newLevel = Math.floor(newXP / 100) + 1;

  // Update profile and create XP log in a transaction
  const updatedProfile = await prisma.$transaction(async (tx) => {
    const updated = await tx.gamificationProfile.update({
      where: { id: profile!.id },
      data: {
        xp: newXP,
        level: newLevel,
      },
    });

    await tx.xPLog.create({
      data: {
        profileId: profile!.id,
        amount,
        reason,
      },
    });

    return updated;
  });

  return updatedProfile;
}
export async function evaluateBadges(userId: string) {
  let profile = await prisma.gamificationProfile.findUnique({
    where: { userId },
    include: { userBadges: true },
  });

  if (!profile) {
    profile = await prisma.gamificationProfile.create({
      data: {
        userId,
        xp: 0,
        level: 1,
      },
      include: { userBadges: true },
    });
  }

  const existingBadgeNames = profile.userBadges.map((b) => b.badgeName);
  
  // 1. First Blood: Awarded when they make their first Submission
  if (!existingBadgeNames.includes('First Blood')) {
    const submissionCount = await prisma.submission.count({
      where: { userId },
    });
    
    if (submissionCount > 0) {
      await prisma.userBadge.create({
        data: {
          profileId: profile.id,
          badgeName: 'First Blood',
          iconUrl: '/badges/first-blood.png',
        },
      });
      existingBadgeNames.push('First Blood');
    }
  }

  // 2. Perfect Score: Awarded if they get 100 on a Quiz
  // (Or if score == totalScore depending on how percentage is calculated. We check score >= totalScore assuming totalScore > 0, or just score == 100 if it's strict 100.)
  if (!existingBadgeNames.includes('Perfect Score')) {
    // According to prompt: 'Perfect Score: Awarded if they get 100 on a Quiz.'
    // In our system, maybe score == totalScore is a perfect score. Let's do both to be safe: score == totalScore AND totalScore > 0, or score == 100.
    const perfectQuiz = await prisma.quizAttempt.findFirst({
      where: {
        userId,
        OR: [
          { score: 100 },
          // A bit tricky to do column comparison in standard findFirst without raw query.
        ]
      },
    });

    let hasPerfectScore = false;
    
    if (perfectQuiz) {
      hasPerfectScore = true;
    } else {
      // Find manually if totalScore == score
      const allAttempts = await prisma.quizAttempt.findMany({
        where: { userId },
        select: { score: true, totalScore: true }
      });
      hasPerfectScore = allAttempts.some(a => a.totalScore > 0 && a.score === a.totalScore);
    }

    if (hasPerfectScore) {
      await prisma.userBadge.create({
        data: {
          profileId: profile.id,
          badgeName: 'Perfect Score',
          iconUrl: '/badges/perfect-score.png',
        },
      });
      existingBadgeNames.push('Perfect Score');
    }
  }
}
