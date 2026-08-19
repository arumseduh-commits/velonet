import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chapterId, title, type, content, order } = body;

    if (!chapterId || !title || !type || order === undefined) {
      return NextResponse.json(
        { error: "ChapterId, title, type, and order are required" },
        { status: 400 }
      );
    }

    const lesson = await prisma.lesson.create({
      data: {
        chapterId,
        title,
        type,
        content,
        order,
      },
    });

    return NextResponse.json(lesson, { status: 201 });
  } catch (error) {
    console.error("[LESSONS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
