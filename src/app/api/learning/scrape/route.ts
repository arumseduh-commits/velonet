import { NextResponse } from "next/server";
import { scrapeLatestMisterGuruPosts } from "@/lib/misterguru-scraper";

export async function POST(req: Request) {
  try {
    let limit = 15;
    try {
      const body = await req.json();
      if (body.limit && typeof body.limit === "number") {
        limit = body.limit;
      }
    } catch (e) {
      // Body empty, use default 15
    }

    console.log(`[Scraper] Memulai scraping ${limit} artikel dari MisterGuru.web.id...`);
    const articles = await scrapeLatestMisterGuruPosts(limit);

    return NextResponse.json({
      success: true,
      message: `Berhasil meng-scrape ${articles.length} artikel & kuis terbaru dari MisterGuru.web.id!`,
      totalScraped: articles.length,
      data: articles,
    });
  } catch (err: any) {
    console.error("[Scraper] Error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal meng-scrape MisterGuru.web.id." },
      { status: 500 }
    );
  }
}
