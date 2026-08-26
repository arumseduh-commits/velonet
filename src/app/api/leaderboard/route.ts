import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type") || "global";

    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        name: { not: null },
      },
      select: {
        id: true,
        name: true,
        studentClass: true,
        status: true,
        attendances: {
          where: { status: "HADIR" },
          select: { id: true },
        },
        gamification: {
          select: {
            xp: true,
            level: true,
            streak: true,
          },
        },
      },
    });

    const leaderboard = students
      .map((s) => {
        const baseProfileXp = s.status === "COMPLETED" ? 100 : 25;
        const attendanceXp = s.attendances.length * 50;
        const gameXp = s.gamification?.xp || 0;
        const totalXp = gameXp > 0 ? gameXp : baseProfileXp + attendanceXp;
        const calculatedLevel = Math.max(1, Math.floor(totalXp / 100) + 1);

        const multiplier = type === "monthly" ? 0.4 : 1.0;
        const finalXp = Math.round(totalXp * multiplier);

        return {
          id: s.id,
          name: s.name || "Siswa Velocity",
          studentClass: s.studentClass || "X",
          xp: finalXp,
          level: s.gamification?.level || calculatedLevel,
          streak: s.gamification?.streak || Math.min(s.attendances.length, 7),
          hadirCount: s.attendances.length,
        };
      })
      .sort((a, b) => b.xp - a.xp);

    return NextResponse.json(leaderboard);
  } catch (error: any) {
    console.error("Failed to fetch leaderboard:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
