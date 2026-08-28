import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";
import { processTeacherChat } from "@/lib/ai-teacher-copilot";

export async function POST(req: Request) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, content, contextTopicId } = body;

    if (!sessionId || !content) {
      return NextResponse.json({ success: false, error: "Parameter tidak lengkap." }, { status: 400 });
    }

    // 1. Save User (Teacher) Message
    await prisma.aIChatMessage.create({
      data: {
        sessionId,
        role: "user",
        content,
      },
    });

    // 2. Fetch history
    const history = await prisma.aIChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    // 3. Process Copilot Response
    const aiResult = await processTeacherChat({
      userMessage: content,
      contextTopicId,
      history: history.map((h) => ({ role: h.role, content: h.content })),
    });

    // 4. Save AI Response
    const aiMessage = await prisma.aIChatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: aiResult.message,
        generatedQuizDraft: aiResult.quizDraft ? JSON.stringify(aiResult.quizDraft) : null,
      },
    });

    // Update session timestamp
    await prisma.aIChatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        reply: aiMessage.content,
        quizDraft: aiResult.quizDraft || null,
        messageId: aiMessage.id,
      },
    });
  } catch (err: any) {
    console.error("[AI Chat Message POST]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
