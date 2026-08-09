import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RegistrationStatus } from "@/lib/bot-state-machine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [total, completed, optedOut, waitingConfirmation, inProgress, excluded] =
      await Promise.all([
        prisma.participant.count(),
        prisma.participant.count({ where: { status: RegistrationStatus.COMPLETED } }),
        prisma.participant.count({ where: { status: RegistrationStatus.OPTED_OUT } }),
        prisma.participant.count({
          where: {
            status: {
              in: [RegistrationStatus.NOT_STARTED, RegistrationStatus.WAITING_CONFIRMATION],
            },
          },
        }),
        prisma.participant.count({
          where: {
            status: {
              in: [
                RegistrationStatus.WAITING_NAME,
                RegistrationStatus.WAITING_CLASS,
                RegistrationStatus.WAITING_MOTIVATION,
                RegistrationStatus.WAITING_HOBBY,
              ],
            },
          },
        }),
        prisma.participant.count({ where: { isExcluded: true } }),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        total,
        completed,
        optedOut,
        waitingConfirmation,
        inProgress,
        excluded,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch dashboard statistics." },
      { status: 500 }
    );
  }
}
