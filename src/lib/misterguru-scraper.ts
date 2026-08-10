import { prisma } from "./prisma";

interface BloggerFeedEntry {
  id?: { $t?: string };
  title?: { $t?: string };
  published?: { $t?: string };
  updated?: { $t?: string };
  category?: Array<{ term?: string }>;
  content?: { $t?: string };
  link?: Array<{ rel?: string; href?: string; title?: string }>;
}

export interface GeneratedQuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

/**
 * Intelligent Quiz & Vocabulary Generator from Raw Article Text
 */
export function generateQuizFromContent(title: string, rawText: string): GeneratedQuizQuestion[] {
  const quizzes: GeneratedQuizQuestion[] = [];
  const clean = rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  // Extract key sentences
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 25 && s.length < 160);

  // 1. Title/Main Subject Question
  quizzes.push({
    question: `Berdasarkan artikel "${title}", topik utama yang dibahas adalah...`,
    options: [
      title,
      "Sejarah perkembangan teknologi komputer",
      "Kumpulan resep masakan tradisional",
      "Jadwal pertandingan olahraga nasional",
    ],
    answerIndex: 0,
    explanation: `Artikel ini berfokus pada pembahasan ${title}.`,
  });

  // 2. Sentence-based context question
  if (sentences.length > 0) {
    const sampleSentence = sentences[Math.floor(sentences.length / 2)] || sentences[0];
    const words = sampleSentence.split(" ").filter((w) => w.length > 4);
    if (words.length > 3) {
      const targetWord = words[Math.floor(words.length / 2)].replace(/[^a-zA-Z]/g, "");
      quizzes.push({
        question: `Dalam konteks bacaan: "${sampleSentence.slice(0, 100)}...", kata "${targetWord}" memiliki makna yang berkaitan dengan...`,
        options: [
          "Konsep atau istilah penting dalam pembahasan materi",
          "Nama kota di Eropa",
          "Jenis makanan saji",
          "Angka perhitungan matematika",
        ],
        answerIndex: 0,
        explanation: `Kata '${targetWord}' merupakan kosakata/istilah penting yang digunakan dalam artikel.`,
      });
    }
  }

  // 3. Educational Purpose Question
  quizzes.push({
    question: "Apakah tujuan utama dari mempelajari materi Bahasa Inggris ini?",
    options: [
      "Meningkatkan pemahaman tata bahasa & keterampilan komunikasi",
      "Menghafal rumus fisika kuantum",
      "Mengganti sistem operasi komputer",
      "Menulis novel fiksi ilmiah",
    ],
    answerIndex: 0,
    explanation: "Materi edukasi dari MisterGuru bertujuan meningkatkan kelancaran tata bahasa dan kemampuan berkomunikasi.",
  });

  return quizzes;
}

/**
 * Clean Raw HTML from Blogger Widgets & Ad Scripts
 */
export function cleanBloggerHtml(rawHtml: string): string {
  let cleaned = rawHtml;
  // Remove ads and scripts
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  cleaned = cleaned.replace(/\(Ads\d?\)/gi, "");
  cleaned = cleaned.replace(/<b:if[^>]*>/gi, "").replace(/<\/b:if>/gi, "");
  return cleaned.trim();
}

/**
 * Dynamic Scraper: Fetches latest posts directly from MisterGuru.web.id Blogger API
 */
export async function scrapeLatestMisterGuruPosts(maxResults: number = 15) {
  const feedUrl = `https://www.misterguru.web.id/feeds/posts/default?alt=json&max-results=${maxResults}`;

  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) VeloNetScraper/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch MisterGuru feed: ${response.statusText}`);
  }

  const json = await response.json();
  const entries: BloggerFeedEntry[] = json.feed?.entry || [];

  const scrapedArticles = [];

  for (const entry of entries) {
    const title = entry.title?.$t || "Untitled Material";
    const rawContent = entry.content?.$t || "";
    const cleanedContent = cleanBloggerHtml(rawContent);

    // Find alternate HTML link
    const altLink = entry.link?.find((l) => l.rel === "alternate")?.href || "https://www.misterguru.web.id/";

    // Extract categories/labels
    const categoryTerms = (entry.category || []).map((c) => c.term || "").filter(Boolean);
    
    let category = "Grammar Guide";
    if (categoryTerms.some((t) => t.includes("TOEIC") || t.includes("TOEFL"))) {
      category = "TOEIC & Test Preps";
    } else if (categoryTerms.some((t) => t.includes("Speaking") || t.includes("Dialogue"))) {
      category = "Speaking & Dialogues";
    } else if (categoryTerms.some((t) => t.includes("Text") || t.includes("Exposition"))) {
      category = "Text Genres";
    } else if (categoryTerms.some((t) => t.includes("Vocabulary") || t.includes("Words"))) {
      category = "Vocabulary Builder";
    }

    // Determine level
    let level = "Intermediate";
    if (categoryTerms.includes("Beginner")) level = "Beginner";
    if (categoryTerms.includes("Advanced")) level = "Advanced";

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Summary extraction
    const plainText = cleanedContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const summary = plainText.slice(0, 180) + "...";

    // Generate Quiz
    const quiz = generateQuizFromContent(title, plainText);

    // Upsert to DB
    const saved = await prisma.scrapedArticle.upsert({
      where: { slug },
      update: {
        title,
        category,
        level,
        summary,
        contentHtml: cleanedContent,
        sourceUrl: altLink,
        quizData: JSON.stringify(quiz),
      },
      create: {
        title,
        slug,
        category,
        level,
        summary,
        contentHtml: cleanedContent,
        sourceUrl: altLink,
        quizData: JSON.stringify(quiz),
      },
    });

    scrapedArticles.push(saved);
  }

  return scrapedArticles;
}
