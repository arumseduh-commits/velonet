import { prisma } from "./prisma";
import { MISTERGURU_MATERIALS } from "@/data/misterguru-data";

export interface MultiFormatQuestionDraft {
  type: "SINGLE_CHOICE" | "CHECKBOXES" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
  text: string;
  points: number;
  sampleAnswer?: string;
  gradingRubric?: string;
  options?: {
    text: string;
    isCorrect: boolean;
  }[];
}

export interface GeneratedMultiQuizDraft {
  title: string;
  description: string;
  category: string;
  durationMinutes: number;
  maxStrikes: number;
  enableFullscreenLock: boolean;
  enableCameraProctor: boolean;
  enableTabSwitchDetect: boolean;
  supervisorPin: string;
  questions: MultiFormatQuestionDraft[];
}

export interface AICopilotResponse {
  message: string;
  quizDraft?: GeneratedMultiQuizDraft;
}

/**
 * AI Teacher Copilot Engine with RAG Context from MisterGuru
 */
export async function processTeacherChat({
  userMessage,
  contextTopicId,
  history = [],
}: {
  userMessage: string;
  contextTopicId?: string;
  history?: Array<{ role: string; content: string }>;
}): Promise<AICopilotResponse> {
  const query = userMessage.toLowerCase();

  // 1. Fetch RAG Context from MisterGuru Knowledge Base
  let contextMaterial: any = null;
  if (contextTopicId) {
    contextMaterial = await prisma.scrapedArticle.findUnique({
      where: { id: contextTopicId },
    });
    if (!contextMaterial) {
      contextMaterial = MISTERGURU_MATERIALS.find((m) => m.id === contextTopicId);
    }
  }

  // If no explicit contextTopicId, search relevant article from query
  if (!contextMaterial) {
    const dbArticles = await prisma.scrapedArticle.findMany({ take: 10 });
    contextMaterial = dbArticles.find(
      (a) =>
        query.includes(a.title.toLowerCase()) ||
        query.includes(a.category.toLowerCase()) ||
        (a.summary && query.includes(a.summary.toLowerCase().slice(0, 20)))
    );
    if (!contextMaterial) {
      contextMaterial = MISTERGURU_MATERIALS[0];
    }
  }

  const topicTitle = contextMaterial ? contextMaterial.title : "Tata Bahasa & Komunikasi Bahasa Inggris";
  const topicCategory = contextMaterial ? contextMaterial.category : "General Grammar";
  const rawContent = contextMaterial ? (contextMaterial.contentHtml || contextMaterial.contentMarkdown || "") : "";
  const cleanContent = rawContent.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  // 2. Check if user is asking to create/generate questions or CBT quiz
  const isAskingForQuiz =
    query.includes("buat") ||
    query.includes("soal") ||
    query.includes("kuis") ||
    query.includes("ujian") ||
    query.includes("generate") ||
    query.includes("cbt") ||
    query.includes("essay") ||
    query.includes("uraian");

  if (isAskingForQuiz) {
    // Generate Multi-Format Questions (Single Choice, Checkboxes, True/False, Short Answer, Essay)
    const questions: MultiFormatQuestionDraft[] = [];

    // 1. Single Choice (Radio)
    questions.push({
      type: "SINGLE_CHOICE",
      text: `Berdasarkan materi "${topicTitle}", manakah pernyataan di bawah ini yang paling tepat mengenai aturan penggunaannya?`,
      points: 10,
      options: [
        { text: `Penerapan pola baku sesuai kaidah tata bahasa pada ${topicTitle}.`, isCorrect: true },
        { text: "Struktur kalimat yang tidak memerlukan kata kerja bantu (auxiliary verb).", isCorrect: false },
        { text: "Pola penulisan yang hanya boleh digunakan pada dokumen sastra kuno.", isCorrect: false },
        { text: "Penggunaan bentuk lampau untuk semua subjek tanpa memandang waktu.", isCorrect: false },
      ],
    });

    // 2. Multiple Checkboxes (Banyak Jawaban Benar)
    questions.push({
      type: "CHECKBOXES",
      text: `Pilihlah SEMUA pernyataan atau contoh di bawah ini yang BENAR terkait materi "${topicTitle}": (Bisa lebih dari 1 jawaban)`,
      points: 15,
      options: [
        { text: "Membantu memperjelas makna dan hubungan antar subjek dalam kalimat.", isCorrect: true },
        { text: "Mengikuti kaidah subject-verb agreement yang sesuai.", isCorrect: true },
        { text: "Dapat digunakan secara luas baik dalam komunikasi formal maupun informal.", isCorrect: true },
        { text: "Hanya berlaku jika kalimat memiliki lebih dari tiga klausa independen.", isCorrect: false },
      ],
    });

    // 3. True / False (Benar atau Salah)
    questions.push({
      type: "TRUE_FALSE",
      text: `Pernyataan: "Pada materi ${topicTitle}, perubahan bentuk kata kerja atau kata sifat dipengaruhi oleh konteks waktu dan perbandingan subjek."`,
      points: 10,
      options: [
        { text: "BENAR", isCorrect: true },
        { text: "SALAH", isCorrect: false },
      ],
    });

    // 4. Short Answer (Isian Singkat)
    questions.push({
      type: "SHORT_ANSWER",
      text: `Tuliskan istilah atau kata kunci utama dalam Bahasa Inggris yang menjadi fokus pembelajaran pada materi "${topicTitle}":`,
      points: 10,
      sampleAnswer: topicTitle.split(" ")[0] || "Grammar",
      gradingRubric: `Kata kunci yang tepat berkaitan dengan ${topicTitle}.`,
    });

    // 5. Essay / Soal Uraian Terbuka
    questions.push({
      type: "ESSAY",
      text: `Jelaskan secara mendalam konsep materi "${topicTitle}". Berikan minimal dua contoh kalimat lengkap beserta penjelasan fungsi dan rumusnya!`,
      points: 25,
      sampleAnswer: `Materi ${topicTitle} merupakan konsep tata bahasa yang digunakan untuk menyusun kalimat yang tepat. Contoh 1: "She speaks English fluently." Contoh 2: "They have completed their project on time." Fungsi utamanya adalah memastikan keselarasan subjek dan predikat dalam komunikasi.`,
      gradingRubric: `Rubrik Penilaian:
1. Ketepatan penjelasan konsep dasar (Bobot: 40%)
2. Keberadaan 2 contoh kalimat yang gramatikal dan relevan (Bobot: 40%)
3. Kejelasan pemaparan fungsi dan rumus (Bobot: 20%)`,
    });

    const supervisorPin = Math.floor(100000 + Math.random() * 900000).toString();

    const quizDraft: GeneratedMultiQuizDraft = {
      title: `Ujian CBT Multi-Format: ${topicTitle}`,
      description: `Ujian komprehensif (Pilihan Ganda, Checkboxes, Benar/Salah, Isian Singkat, & Uraian) berbasis materi "${topicTitle}". Dilengkapi penilaian cerdas dan pengamanan VeloExambro.`,
      category: topicCategory,
      durationMinutes: 30,
      maxStrikes: 3,
      enableFullscreenLock: true,
      enableCameraProctor: true,
      enableTabSwitchDetect: true,
      supervisorPin,
      questions,
    };

    return {
      message: `Tentu! Saya telah menganalisis materi **"${topicTitle}"** dari database MisterGuru dan menyusun draf ujian **Multi-Format** (${questions.length} soal) yang terdiri dari:\n\n- 🔹 **1 Soal Pilihan Ganda (Single Choice)**\n- 🔹 **1 Soal Kotak Centang (Multiple Checkboxes)**\n- 🔹 **1 Soal Benar / Salah (True/False)**\n- 🔹 **1 Soal Isian Singkat (Short Answer)**\n- 🔹 **1 Soal Uraian (Essay)** lengkap dengan contoh jawaban ideal & rubrik pembobotan nilai.\n\nSilakan tinjau draf soal di bawah ini, Anda dapat memodifikasinya atau langsung klik **"🚀 Terbitkan ke VeloExambro"**!`,
      quizDraft,
    };
  }

  // Conversational response
  return {
    message: `Halo! Saya adalah **AI Teacher Assistant** untuk VeloNet LMS. Saya terhubung dengan basis pengetahuan **MisterGuru** (topik aktif saat ini: *"${topicTitle}"*).\n\nAda yang bisa saya bantu hari ini? Anda bisa meminta saya untuk:\n1. 📝 **Membuat draf soal ujian CBT multi-tipe** (Pilihan Ganda, Checkbox, Isian, & Uraian).\n2. 💡 **Menyusun rubrik penilaian uraian & pembobotan otomatis**.\n3. 🔍 **Mencari dan merangkum materi tata bahasa & bacaan dari bank data**.\n\nKetik permintaan Anda di bawah!`,
  };
}
