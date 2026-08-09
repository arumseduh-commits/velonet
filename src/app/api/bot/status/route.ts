import { NextRequest, NextResponse } from "next/server";
import { botEngine } from "@/lib/bot-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const streamParam = req.nextUrl.searchParams.get("stream");

  if (streamParam === "true") {
    const encoder = new TextEncoder();

    const customStream = new ReadableStream({
      start(controller) {
        // Send initial status
        const initialStatus = botEngine.getStatus();
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "status", data: initialStatus })}\n\n`)
        );

        const onStatus = (status: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "status", data: status })}\n\n`)
          );
        };

        const onLog = (logMessage: string) => {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "log",
                data: { message: logMessage, time: new Date().toLocaleTimeString() },
              })}\n\n`
            )
          );
        };

        botEngine.on("status", onStatus);
        botEngine.on("log", onLog);

        req.signal.addEventListener("abort", () => {
          botEngine.off("status", onStatus);
          botEngine.off("log", onLog);
        });
      },
    });

    return new NextResponse(customStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: botEngine.getStatus(),
  });
}
