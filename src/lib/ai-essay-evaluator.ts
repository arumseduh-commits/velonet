export interface EssayGradingInput {
  questionText: string;
  sampleAnswer?: string | null;
  gradingRubric?: string | null;
  studentResponse: string;
  maxPoints: number;
}

export interface EssayGradingResult {
  suggestedScore: number;
  percentage: number;
  feedback: string;
  matchedKeywords: string[];
  missingKeywords: string[];
}

/**
 * Intelligent AI Essay Evaluator
 * Evaluates student open-ended essay answers against sample answers, rubrics, and keyword criteria.
 */
export function evaluateStudentEssay({
  questionText,
  sampleAnswer,
  gradingRubric,
  studentResponse,
  maxPoints = 10,
}: EssayGradingInput): EssayGradingResult {
  const cleanStudentText = (studentResponse || "").trim().toLowerCase();
  
  if (!cleanStudentText || cleanStudentText.length < 5) {
    return {
      suggestedScore: 0,
      percentage: 0,
      feedback: "Jawaban kosong atau terlalu singkat untuk dinilai.",
      matchedKeywords: [],
      missingKeywords: [],
    };
  }

  // 1. Extract key expected terms from sample answer or rubric
  const referenceSource = `${sampleAnswer || ""} ${gradingRubric || ""} ${questionText}`;
  const rawWords = referenceSource
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4);

  // Remove common stop words
  const stopWords = new Set([
    "which", "there", "their", "about", "would", "these", "other", "words",
    "could", "write", "first", "water", "after", "where", "right", "think",
    "three", "years", "place", "sound", "great", "again", "still", "every",
    "dalam", "adalah", "dengan", "untuk", "sebagai", "bahwa", "karena", "materi",
    "seperti", "jawaban", "contoh", "menurut", "secara", "memiliki"
  ]);

  const uniqueKeywords = Array.from(new Set(rawWords.filter((w) => !stopWords.has(w)))).slice(0, 8);

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  uniqueKeywords.forEach((kw) => {
    if (cleanStudentText.includes(kw)) {
      matchedKeywords.push(kw);
    } else {
      missingKeywords.push(kw);
    }
  });

  // 2. Length & Elaboration Score
  const wordCount = cleanStudentText.split(/\s+/).length;
  let lengthFactor = 0.3;
  if (wordCount >= 20) lengthFactor = 1.0;
  else if (wordCount >= 10) lengthFactor = 0.7;
  else if (wordCount >= 5) lengthFactor = 0.4;

  // 3. Keyword Match Ratio
  const keywordRatio = uniqueKeywords.length > 0 ? matchedKeywords.length / uniqueKeywords.length : 0.8;

  // 4. Combined Weighting
  let scoreRatio = keywordRatio * 0.65 + lengthFactor * 0.35;
  if (scoreRatio > 1) scoreRatio = 1;
  if (scoreRatio < 0.1) scoreRatio = 0.1;

  const rawScore = Math.round(scoreRatio * maxPoints * 10) / 10;
  const percentage = Math.round(scoreRatio * 100);

  // 5. Constructive AI Feedback
  let feedback = "";
  if (percentage >= 85) {
    feedback = `Jawaban sangat baik dan komprehensif (${wordCount} kata). Konsep utama tersampaikan dengan jelas dan mencakup poin penting seperti "${matchedKeywords.slice(0, 3).join(", ")}".`;
  } else if (percentage >= 60) {
    feedback = `Jawaban cukup baik (${wordCount} kata) dan relevan. Namun penjelasan dapat diperdalam dengan menambahkan konsep ${missingKeywords.slice(0, 2).join(" dan ")}.`;
  } else {
    feedback = `Jawaban perlu dielaborasi lebih lanjut (${wordCount} kata). Pastikan mengaitkan dengan konsep utama dan rumus/kaidah yang diminta pada soal.`;
  }

  return {
    suggestedScore: rawScore,
    percentage,
    feedback,
    matchedKeywords,
    missingKeywords,
  };
}
