import { NextRequest, NextResponse } from "next/server";
import { runReminderBatch } from "@/lib/reminder-cron";

export async function POST(req: NextRequest) {
  try {
    let cooldownHours = 24;
    try {
      const body = await req.json();
      if (body.cooldownHours && typeof body.cooldownHours === "number") {
        cooldownHours = body.cooldownHours;
      }
    } catch (e) {
      // JSON body is optional
    }

    const result = await runReminderBatch(cooldownHours);
    return NextResponse.json({
      success: true,
      message: `Reminder batch executed. Sent: ${result.sentCount}, Failed: ${result.failedCount}`,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute reminder batch." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // Support GET request for easy cron pinging
  try {
    const result = await runReminderBatch(24);
    return NextResponse.json({
      success: true,
      message: `Reminder batch executed via GET. Sent: ${result.sentCount}, Failed: ${result.failedCount}`,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute reminder batch." },
      { status: 500 }
    );
  }
}
