import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json(course);
  } catch (error) {
    console.error("[COURSE_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, slug, description, thumbnail, isPublished } = body;

    const course = await prisma.course.update({
      where: { id },
      data: {
        title,
        slug,
        description,
        thumbnail,
        isPublished,
      },
    });

    return NextResponse.json(course);
  } catch (error) {
    console.error("[COURSE_PUT]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const course = await prisma.course.delete({
      where: { id },
    });

    return NextResponse.json(course);
  } catch (error) {
    console.error("[COURSE_DELETE]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
