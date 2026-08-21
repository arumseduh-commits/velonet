import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const cache: Record<string, { data: any; time: number }> = {};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type") || "global";

    const now = Date.now();
    if (cache[type] && now - cache[type].time < 20000) {
      return NextResponse.json(cache[type].data);
    }

    if (type === "global") {
      const topStudents = await prisma.user.findMany({
        where: {
          role: "STUDENT",
          gamification: {
            isNot: null,
          },
        },
        select: {
          id: true,
          name: true,
          gamification: {
            select: {
              xp: true,
              level: true,
            },
          },
        },
        orderBy: {
          gamification: {
            xp: "desc",
          },
        },
        take: 50,
      });

      // Flatten structure
      const leaderboard = topStudents.map((s) => ({
        id: s.id,
        name: s.name || "Unknown",
        xp: s.gamification?.xp || 0,
        level: s.gamification?.level || 1,
      }));

      cache[type] = { data: leaderboard, time: now };
      return NextResponse.json(leaderboard);
    } else if (type === "monthly") {
      // Mock monthly logic
      const topStudents = await prisma.user.findMany({
        where: {
          role: "STUDENT",
          gamification: {
            isNot: null,
          },
        },
        select: {
          id: true,
          name: true,
          gamification: {
            select: {
              xp: true,
              level: true,
            },
          },
        },
        take: 50,
      });

      // Shuffle or randomize slightly for mock monthly data
      const leaderboard = topStudents
        .map((s) => ({
          id: s.id,
          name: s.name || "Unknown",
          xp: Math.floor((s.gamification?.xp || 0) * 0.4), // mock a smaller monthly XP
          level: s.gamification?.level || 1,
        }))
        .sort((a, b) => b.xp - a.xp);

      cache[type] = { data: leaderboard, time: now };
      return NextResponse.json(leaderboard);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error: any) {
    console.error("Failed to fetch leaderboard:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
