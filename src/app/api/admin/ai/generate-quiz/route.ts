import { NextResponse } from "next/server";
import { getLoggedInAdmin } from "@/lib/admin-auth";
import { generateQuizWithAI } from "@/lib/ai-quiz-assistant";

export async function POST(req: Request) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      topicId,
      customTopic,
      questionCount = 10,
      difficulty = "Intermediate",
      pointsPerQuestion = 10,
      durationMinutes = 30,
    } = body;

    const generated = await generateQuizWithAI({
      topicId,
      customTopic,
      questionCount: Number(questionCount) || 10,
      difficulty,
      pointsPerQuestion: Number(pointsPerQuestion) || 10,
      durationMinutes: Number(durationMinutes) || 30,
    });

    return NextResponse.json({
      success: true,
      message: `AI berhasil meng-generate ${generated.questions.length} soal untuk topik "${generated.title}"!`,
      data: generated,
    });
  } catch (err: any) {
    console.error("[AI Generate Quiz API]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal meng-generate kuis dengan AI." },
      { status: 500 }
    );
  }
}
