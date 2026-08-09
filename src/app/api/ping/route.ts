import { NextResponse } from "next/server";
import { botEngine } from "@/lib/bot-engine";

export async function GET() {
  const status = botEngine.getStatus();
  return NextResponse.json({
    status: "ok",
    botState: status.state,
    timestamp: new Date().toISOString(),
  });
}
