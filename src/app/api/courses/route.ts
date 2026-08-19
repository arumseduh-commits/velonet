import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";

export async function GET() {
  try {
    const courses = await prisma.course.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(courses);
  } catch (error) {
    console.error("[COURSES_GET]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, slug, description, thumbnail, isPublished } = body;

    if (!title || !slug) {
      return NextResponse.json(
        { error: "Title and slug are required" },
        { status: 400 }
      );
    }

    const course = await prisma.course.create({
      data: {
        title,
        slug,
        description,
        thumbnail,
        isPublished: isPublished ?? false,
      },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("[COURSES_POST]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
