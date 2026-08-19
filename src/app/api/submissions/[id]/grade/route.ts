import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { botEngine } from "@/lib/bot-engine";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { score, feedback } = body;

    if (score === undefined) {
      return NextResponse.json(
        { error: "score is required" },
        { status: 400 }
      );
    }

    const submission = await prisma.submission.update({
      where: { id },
      data: {
        score,
        feedback,
        gradedAt: new Date(),
      },
      include: {
        user: true,
        assignment: {
          include: {
            lesson: {
              include: {
                chapter: {
                  include: {
                    course: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Extract necessary data for WhatsApp notification
    const phoneNumber = submission.user.phoneNumber;
    const courseName = submission.assignment.lesson.chapter.course.title;

    if (phoneNumber && courseName) {
      try {
        await botEngine.sendGradeNotification(phoneNumber, courseName, score);
      } catch (waError) {
        console.error("Failed to send WhatsApp grade notification:", waError);
      }
    }

    return NextResponse.json(submission, { status: 200 });
  } catch (error) {
    console.error("Failed to grade submission:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
