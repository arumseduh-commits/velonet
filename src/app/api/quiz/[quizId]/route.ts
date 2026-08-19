import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInStudent } from "@/lib/student-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    const student = await getLoggedInStudent();
    if (!student) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { quizId } = await params;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            options: {
              select: {
                id: true,
                text: true,
                // Do not return isCorrect to the client!
              }
            }
          }
        }
      }
    });

    if (!quiz) {
      return NextResponse.json({ success: false, error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: quiz });
  } catch (err) {
    console.error("[Quiz API GET]", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
