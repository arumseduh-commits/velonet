import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoggedInAdmin } from "@/lib/admin-auth";
import { MISTERGURU_MATERIALS } from "@/data/misterguru-data";

export async function GET() {
  try {
    const admin = await getLoggedInAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const dbArticles = await prisma.scrapedArticle.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        level: true,
        summary: true,
        sourceUrl: true,
        scrapedAt: true,
      },
      orderBy: { scrapedAt: "desc" },
    });

    if (dbArticles.length > 0) {
      return NextResponse.json({
        success: true,
        source: "database",
        total: dbArticles.length,
        data: dbArticles,
      });
    }

    // Fallback to initial seed materials if DB table is empty
    const fallbackList = MISTERGURU_MATERIALS.map((m) => ({
      id: m.id,
      title: m.title,
      slug: m.id,
      category: m.category,
      level: m.level,
      summary: m.summary,
      sourceUrl: m.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }));

    return NextResponse.json({
      success: true,
      source: "seed",
      total: fallbackList.length,
      data: fallbackList,
    });
  } catch (err: any) {
    console.error("[AI Knowledge Base API]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memuat knowledge base." },
      { status: 500 }
    );
  }
}
