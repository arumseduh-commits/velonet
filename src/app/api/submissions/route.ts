import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { awardXP, evaluateBadges } from "@/lib/gamification";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { assignmentId, userId, contentUrl, textResponse } = body;

    if (!assignmentId || !userId) {
      return NextResponse.json(
        { error: "assignmentId and userId are required" },
        { status: 400 },
      );
    }

    if (!contentUrl && !textResponse) {
      return NextResponse.json(
        {
          error: "At least one of contentUrl or textResponse must be provided",
        },
        { status: 400 },
      );
    }

    const submission = await prisma.submission.create({
      data: {
        assignmentId,
        userId,
        contentUrl,
        textResponse,
      },
    });

    try {
      await awardXP(userId, 100, "Menyelesaikan Tugas");
      await evaluateBadges(userId);
    } catch (xpError) {
      console.error("Failed to award XP:", xpError);
    }

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    console.error("Failed to submit assignment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
