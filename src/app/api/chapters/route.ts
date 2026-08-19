import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseId, title, order } = body;

    if (!courseId || !title || order === undefined) {
      return NextResponse.json(
        { error: "CourseId, title, and order are required" },
        { status: 400 }
      );
    }

    const chapter = await prisma.chapter.create({
      data: {
        courseId,
        title,
        order,
      },
    });

    return NextResponse.json(chapter, { status: 201 });
  } catch (error) {
    console.error("[CHAPTERS_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
