import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RegistrationStatus } from "@/lib/bot-state-machine";

export const dynamic = "force-dynamic";

let cachedStats: any = null;
let lastStatsFetchTime = 0;

export async function GET() {
  try {
    const now = Date.now();
    if (cachedStats && now - lastStatsFetchTime < 10000) {
      return NextResponse.json({
        success: true,
        data: cachedStats,
      });
    }

    const users = await prisma.user.findMany({
      select: {
        status: true,
        isExcluded: true,
      },
    });

    let completed = 0;
    let optedOut = 0;
    let waitingConfirmation = 0;
    let inProgress = 0;
    let excluded = 0;

    for (const u of users) {
      if (u.isExcluded) excluded++;
      if (u.status === RegistrationStatus.COMPLETED) completed++;
      else if (u.status === RegistrationStatus.OPTED_OUT) optedOut++;
      else if (
        u.status === RegistrationStatus.NOT_STARTED ||
        u.status === RegistrationStatus.WAITING_CONFIRMATION
      ) {
        waitingConfirmation++;
      } else if (
        [
          RegistrationStatus.WAITING_NAME,
          RegistrationStatus.WAITING_CLASS,
          RegistrationStatus.WAITING_MOTIVATION,
          RegistrationStatus.WAITING_HOBBY,
        ].includes(u.status as any)
      ) {
        inProgress++;
      }
    }

    const result = {
      total: users.length,
      completed,
      optedOut,
      waitingConfirmation,
      inProgress,
      excluded,
    };

    cachedStats = result;
    lastStatsFetchTime = now;

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch dashboard statistics." },
      { status: 500 }
    );
  }
}
