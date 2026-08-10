import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MISTERGURU_MATERIALS } from "@/data/misterguru-data";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");

    const whereCondition: any = {};
    if (category && category !== "ALL") {
      whereCondition.category = category;
    }

    const dbArticles = await prisma.scrapedArticle.findMany({
      where: whereCondition,
      orderBy: { scrapedAt: "desc" },
    });


    // If DB has scraped articles, parse quizData JSON string and return
    if (dbArticles.length > 0) {
      const formatted = dbArticles.map((art) => ({
        id: art.id,
        title: art.title,
        slug: art.slug,
        category: art.category,
        level: art.level,
        readTime: "5 min read",
        summary: art.summary || "",
        contentHtml: art.contentHtml,
        sourceUrl: art.sourceUrl,
        quiz: art.quizData ? JSON.parse(art.quizData) : [],
        scrapedAt: art.scrapedAt,
      }));

      return NextResponse.json({
        success: true,
        source: "database",
        total: formatted.length,
        data: formatted,
      });
    }

    // Fallback to initial seed materials if DB is not yet scraped
    return NextResponse.json({
      success: true,
      source: "seed",
      total: MISTERGURU_MATERIALS.length,
      data: MISTERGURU_MATERIALS,
    });
  } catch (err: any) {
    console.error("[GetArticles] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengambil daftar artikel." },
      { status: 500 }
    );
  }
}
