import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";
import { processGeminiCopilot, extractTextFromDocument } from "@/lib/gemini-copilot";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
    let fileBase64: string | undefined = undefined;
    let fileMimeType: string | undefined = undefined;
    let uploadedImageUrl: string | undefined = undefined;

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

        const lowerName = file.name.toLowerCase();
        const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
        const isImg = file.type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(lowerName);

        if (isPdf) {
          // Send raw PDF directly to Gemini 3.6 Flash Native Multimodal Vision
          fileBase64 = buffer.toString("base64");
          fileMimeType = "application/pdf";
          documentText = `[DOKUMEN PDF: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)]`;
        } else if (isImg) {
          // Save image to public/uploads/questions/ so it has a persistent local URL
          try {
            const uploadDir = path.join(process.cwd(), "public", "uploads", "questions");
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            const isWebP = file.type === "image/webp" || lowerName.endsWith(".webp");
            const ext = isWebP ? ".webp" : path.extname(file.name) || ".png";
            const filename = `ai_upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
            const filePath = path.join(uploadDir, filename);
            fs.writeFileSync(filePath, buffer);
            uploadedImageUrl = `/uploads/questions/${filename}`;
          } catch (saveErr) {
            console.warn("[AI Chat] Failed to save uploaded image to disk:", saveErr);
          }

          // Send raw image to Gemini 3.6 Flash Native Multimodal Vision
          fileBase64 = buffer.toString("base64");
          fileMimeType = file.type || "image/jpeg";
          documentText = `[FOTO / SCAN SOAL: ${file.name}]`;
        } else {
          documentText = await extractTextFromDocument(buffer, file.name, file.type);
        }
      }
    } else {
      const body = await req.json();
      sessionId = body.sessionId;
      content = body.content;
      apiKey = body.apiKey;
      documentText = body.documentText;
      documentName = body.documentName;
      fileBase64 = body.fileBase64 || body.imageBase64;
      fileMimeType = body.fileMimeType || body.imageMimeType;
      uploadedImageUrl = body.uploadedImageUrl;
    }

    if (!sessionId || (!content && !documentText)) {
      return NextResponse.json(
        { success: false, error: "Pesan atau file dokumen wajib disertakan." },
        { status: 400 }
      );
    }

    // Default message content if user only attached a file without typing text
    const userPromptText = content.trim() || (documentName ? `Tolong analisa dokumen "${documentName}" dan buatkan draf soal ujian CBT.` : "Halo AI");

    // 1. Save User Message to Database with Image/Attachment Tag
    let savedContent = userPromptText;
    if (uploadedImageUrl && documentName) {
      savedContent = `📷 [Gambar: ${documentName}|${uploadedImageUrl}]\n${userPromptText}`;
    } else if (documentName) {
      savedContent = `📎 [Lampiran: ${documentName}]\n${userPromptText}`;
    }

    const savedUserMsg = await prisma.aIChatMessage.create({
      data: {
        sessionId,
        role: "user",
        content: savedContent,
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
      fileBase64,
      fileMimeType,
      uploadedImageUrl,
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
        userMessage: {
          id: savedUserMsg.id,
          content: savedUserMsg.content,
        },
      },
    });
  } catch (err: any) {
    console.error("[AI Chat Message POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
