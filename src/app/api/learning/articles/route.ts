import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MISTERGURU_MATERIALS } from "@/data/misterguru-data";

const articlesCache: Record<string, { data: any; time: number }> = {};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || "ALL";

    const now = Date.now();
    if (articlesCache[category] && now - articlesCache[category].time < 60000) {
      return NextResponse.json(articlesCache[category].data);
    }

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

      const resData = {
        success: true,
        source: "database",
        total: formatted.length,
        data: formatted,
      };
      articlesCache[category] = { data: resData, time: now };
      return NextResponse.json(resData);
    }

    // Fallback to initial seed materials if DB is not yet scraped
    const fallbackData = {
      success: true,
      source: "seed",
      total: MISTERGURU_MATERIALS.length,
      data: MISTERGURU_MATERIALS,
    };
    articlesCache[category] = { data: fallbackData, time: now };
    return NextResponse.json(fallbackData);
  } catch (err: any) {
    console.error("[GetArticles] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengambil daftar artikel." },
      { status: 500 }
    );
  }
}
