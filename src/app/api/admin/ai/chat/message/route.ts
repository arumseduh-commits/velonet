import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";
import { processGeminiCopilot, extractTextFromDocument } from "@/lib/gemini-copilot";

export async function POST(req: Request) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";

    let sessionId = "";
    let content = "";
    let apiKey: string | undefined = undefined;
    let documentText: string | undefined = undefined;
    let documentName: string | undefined = undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      sessionId = (formData.get("sessionId") as string) || "";
      content = (formData.get("content") as string) || "";
      apiKey = (formData.get("apiKey") as string) || undefined;

      const file = formData.get("file") as File | null;
      if (file && file.size > 0) {
        documentName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        documentText = await extractTextFromDocument(buffer, file.name, file.type);
      }
    } else {
      const body = await req.json();
      sessionId = body.sessionId;
      content = body.content;
      apiKey = body.apiKey;
      documentText = body.documentText;
      documentName = body.documentName;
    }

    if (!sessionId || (!content && !documentText)) {
      return NextResponse.json(
        { success: false, error: "Pesan atau file dokumen wajib disertakan." },
        { status: 400 }
      );
    }

    // Default message content if user only attached a file without typing text
    const userPromptText = content.trim() || (documentName ? `Tolong analisa dokumen "${documentName}" dan buatkan draf soal ujian CBT.` : "Halo AI");

    // 1. Save User Message to Database
    const savedUserMsg = await prisma.aIChatMessage.create({
      data: {
        sessionId,
        role: "user",
        content: documentName ? `📎 [Lampiran: ${documentName}]\n${userPromptText}` : userPromptText,
      },
    });

    // 2. Fetch history
    const history = await prisma.aIChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    // 3. Process Copilot Response with Gemini Flash / Heuristic Fallback
    const aiResult = await processGeminiCopilot({
      userMessage: userPromptText,
      documentText,
      documentName,
      apiKey,
      history: history.map((h) => ({ role: h.role, content: h.content })),
    });

    // 4. Save Assistant Response
    const aiMessage = await prisma.aIChatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: aiResult.reply,
        generatedQuizDraft: aiResult.quizDraft ? JSON.stringify(aiResult.quizDraft) : null,
      },
    });

    // 5. Update session timestamp
    await prisma.aIChatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        reply: aiMessage.content,
        quizDraft: aiResult.quizDraft || null,
        adminAction: aiResult.adminAction || null,
        source: aiResult.source,
        messageId: aiMessage.id,
      },
    });
  } catch (err: any) {
    console.error("[AI Chat Message POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
