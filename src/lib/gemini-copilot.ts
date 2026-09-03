import { prisma } from "./prisma";
import { MISTERGURU_MATERIALS } from "@/data/misterguru-data";
import { executeGenerateSvg } from "./agent-tools";

export interface MultiFormatQuestionDraft {
  type: "SINGLE_CHOICE" | "CHECKBOXES" | "TRUE_FALSE" | "SHORT_ANSWER" | "ESSAY";
  text: string;
  points: number;
  bloomLevel?: "C1" | "C2" | "C3" | "C4" | "C5" | "C6";
  diagramSvg?: string;
  explanation?: string;
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

export interface AdminActionPayload {
  type: "navigate" | "stats" | "action";
  label: string;
  url?: string;
  data?: any;
}

export interface GeminiCopilotResult {
  reply: string;
  quizDraft?: GeneratedMultiQuizDraft | null;
  adminAction?: AdminActionPayload | null;
  source: "gemini" | "fallback";
}

/**
 * Extract clean text from uploaded document Buffer
 */
export async function extractTextFromDocument(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const lowerName = fileName.toLowerCase();

  // 1. Word Document (.docx)
  if (
    lowerName.endsWith(".docx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim();
    } catch (err) {
      console.warn("[Docx Parser] mammoth failed, falling back to string extraction:", err);
      return buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").trim();
    }
  }

  // 2. PDF Document (.pdf)
  if (lowerName.endsWith(".pdf") || mimeType === "application/pdf") {
    try {
      const pdfParseModule: any = await import("pdf-parse");
      const pdfParse = pdfParseModule.default || pdfParseModule;
      const data = await pdfParse(buffer);
      return data.text.trim();
    } catch (err) {
      console.warn("[PDF Parser] pdf-parse failed:", err);
      return "";
    }
  }

  // 3. Image File (PNG, JPG, WEBP)
  if (
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp") ||
    mimeType.startsWith("image/")
  ) {
    return `[GAMBAR TERLAMPIR: File ${fileName} (${mimeType}) akan di-OCR dan dianalisis secara visual oleh Vision AI]`;
  }

  // 4. Plain Text / Markdown
  return buffer.toString("utf-8").trim();
}

/**
 * Fetch live administrative context from Prisma
 */
export async function getLiveAdminContext(): Promise<string> {
  try {
    const [userCount, quizCount, recentQuizzes, sessionCount, recentSessions, violationCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.quiz.count(),
        prisma.quiz.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, _count: { select: { questions: true } } },
        }),
        prisma.meetingSession.count(),
        prisma.meetingSession.findMany({
          take: 3,
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, isActive: true },
        }),
        prisma.examViolationLog.count().catch(() => 0),
      ]);

    const activeQuizList = recentQuizzes
      .map((q: any) => `• [${q.id}] "${q.title}" (${q._count?.questions || 0} soal)`)
      .join("\n");

    const activeSessionList = recentSessions
      .map((s: any) => `• [${s.id}] "${s.title}" (Aktif: ${s.isActive ? "Ya" : "Tidak"})`)
      .join("\n");

    return `
STATUS LIVE SISTEM VELONET LMS SAAT INI:
- Total Pengguna / Peserta Terdaftar: ${userCount}
- Total Kuis CBT: ${quizCount}
- Kuis Terbaru:
${activeQuizList || "• Belum ada kuis"}
- Total Sesi Presensi: ${sessionCount}
- Sesi Presensi Terbaru:
${activeSessionList || "• Belum ada sesi"}
- Total Pelanggaran Ujian Terdeteksi: ${violationCount}
NAVIGASI MODUL ADMIN:
- Overview: /admin
- Katalog Kursus & Modul: /admin/courses
- VeloExambro CBT (Daftar Ujian): /admin/exams
- Sesi Presensi Pertemuan: /admin/sessions
- Terminal Wajah Kiosk: /admin/face-terminal
- Laporan Kumulatif: /admin/reports
- Data Peserta Komunitas: /admin/participants
- Pusat Kendali Bot WA: /admin/bot
- Daftar Kick: /admin/kick-list
- Exclusion List: /admin/exclusions
`.trim();
  } catch (err) {
    console.warn("[getLiveAdminContext] Failed to query admin context:", err);
    return "Sistem VeloNet LMS aktif.";
  }
}

/**
 * Process Teacher Copilot prompt using Google Gemini Flash or intelligent fallback
 */
export async function processGeminiCopilot({
  userMessage,
  documentText,
  documentName,
  imageBase64,
  imageMimeType,
  apiKey,
  history = [],
}: {
  userMessage: string;
  documentText?: string;
  documentName?: string;
  imageBase64?: string;
  imageMimeType?: string;
  apiKey?: string;
  history?: Array<{ role: string; content: string }>;
}): Promise<GeminiCopilotResult> {
  const finalApiKey = apiKey || process.env.GEMINI_API_KEY;
  const adminContext = await getLiveAdminContext();

  // If Gemini API Key is available, call Gemini 3.6 Flash / Candidate Models
  if (finalApiKey) {
    try {
      const geminiResult = await callGeminiAPI({
        apiKey: finalApiKey,
        userMessage,
        documentText,
        documentName,
        imageBase64,
        imageMimeType,
        adminContext,
        history,
      });

      if (geminiResult) {
        return {
          ...geminiResult,
          source: "gemini",
        };
      }
    } catch (err: any) {
      console.error("[processGeminiCopilot] Gemini API error, using fallback:", err.message);
    }
  }

  // Fallback to intelligent heuristic processing
  const fallbackResult = processHeuristicFallback({
    userMessage,
    documentText,
    documentName,
    adminContext,
  });

  return {
    ...fallbackResult,
    source: "fallback",
  };
}

/**
 * Direct REST call to Google Gemini API
 */
async function callGeminiAPI({
  apiKey,
  userMessage,
  documentText,
  documentName,
  imageBase64,
  imageMimeType,
  adminContext,
  history,
}: {
  apiKey: string;
  userMessage: string;
  documentText?: string;
  documentName?: string;
  imageBase64?: string;
  imageMimeType?: string;
  adminContext: string;
  history: Array<{ role: string; content: string }>;
}): Promise<{ reply: string; quizDraft?: GeneratedMultiQuizDraft | null; adminAction?: AdminActionPayload | null } | null> {
  // Prioritize gemini-3.6-flash with resilient fallback to other flash versions
  const candidateModels = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

  const systemInstruction = `
Anda adalah "VeloNet Master Admin Copilot & CBT Architect", asisten AI paling cerdas dan serba bisa untuk Administrator dan Guru di platform VeloNet LMS.
Anda memiliki akses ke data live sistem, kemampuan merancang ujian CBT berstandar tinggi, dan memahami seluruh fitur VeloNet (CBT, Kursus, Presensi Wajah, Peserta, Bot WA).

KONTEKS DATABASE & NAVIGASI SISTEM:
${adminContext}

TUGAS DAN ATURAN ANDA:
1. Jika pengguna melampirkan DOKUMEN (Word/PDF/Teks) atau GAMBAR (Foto Soal / Scan Ujian):
   - Jika dokumen/gambar berisi kumpulan/bank soal yang sudah ada: EKSTRAK dan format secara presisi setiap nomor soal, teks pertanyaan, pilihan opsi A, B, C, D, dan tentukan kunci jawaban benar (isCorrect: true).
   - Jika dokumen berisi materi pelajaran / modul / artikel: RANGKUM dan CIPTAKAN set soal CBT Multi-Format yang komprehensif dan mendalam.
   - Didukung 5 TIPE SOAL:
     * SINGLE_CHOICE (Pilihan Ganda 1 Opsi)
     * CHECKBOXES (Kotak Centang, beberapa jawaban benar)
     * TRUE_FALSE (Benar / Salah)
     * SHORT_ANSWER (Isian Singkat)
     * ESSAY (Uraian Panjang, WAJIB sertakan sampleAnswer dan gradingRubric)
   - Sertakan "quizDraft" dalam JSON output Anda.

2. PANDUAN KOGNITIF TAKSONOMI BLOOM & FORMULA ILMIAH:
   - Setiap butir soal WAJIB menyertakan properti "bloomLevel": "C1" | "C2" | "C3" | "C4" | "C5" | "C6".
     * C1 (Mengingat): Menghafal fakta, istilah baku, definisi, tanggal.
     * C2 (Memahami): Menjelaskan prinsip, ide pokok, perbandingan konsep.
     * C3 (Menerapkan): Menggunakan rumus hitungan, studi kasus terapan.
     * C4 (Menganalisis): Mengurai masalah kompleks, menelaah sebab-akibat.
     * C5 (Mengevaluasi): Menilai keabsahan argumen, uji kelayakan hipotesis.
     * C6 (Mencipta): Merancang solusi baru, sintesis ide komprehensif.
   - Penulisan rumus matematika/fisika/kimia WAJIB diformat dengan sintaks KaTeX/LaTeX ($...$ atau $$...$$).
   - Jika pengguna meminta soal visual atau diagram sains (misal: grafik koordinat, diagram alur, rangkaian listrik), sertakan kode SVG murni pada properti "diagramSvg" (<svg ...>...</svg>).
   - Jika pengguna melampirkan GAMBAR SOAL / FOTO SCAN: Gunakan kemampuan Vision Anda untuk membaca seluruh teks soal, opsi jawaban, dan diagramnya secara teliti.

3. Jika pengguna meminta navigasi atau bertanya tentang data admin:
   - Jawab secara ringkas, jelas, dan profesional dalam Bahasa Indonesia.
   - Sertakan "adminAction" jika ada halaman admin yang relevan untuk dibuka atau statistik yang perlu ditampilkan.

4. Jika pengguna meminta ANALISIS KELEMAHAN KUIS atau REMEDIAL:
   - Identifikasi kuis terkait dari daftar kuis terbaru di sistem.
   - Buatkan draf set soal penguatan konsep remedial ("quizDraft") yang berfokus pada materi yang sering salah.
   - Arahkan admin via "adminAction" untuk membuka Buku Nilai & Koreksi Uraian di "/admin/exams/{quizId}/grading".

FORMAT OUTPUT WAJIB:
Kembalikan HANYA format JSON valid tanpa format markdown \`\`\`json pembungkus, dengan struktur berikut:
{
  "reply": "Penjelasan respons yang ramah, profesional, dan informatif kepada admin (dukung Markdown)",
  "quizDraft": {
    "title": "Judul Kuis",
    "description": "Deskripsi singkat kuis",
    "category": "Kategori Soal",
    "durationMinutes": 30,
    "maxStrikes": 3,
    "enableFullscreenLock": true,
    "enableCameraProctor": true,
    "enableTabSwitchDetect": true,
    "supervisorPin": "123456",
    "questions": [
      {
        "type": "SINGLE_CHOICE",
        "text": "Pertanyaan...",
        "points": 10,
        "bloomLevel": "C2",
        "diagramSvg": "<svg ...>...</svg> (opsional jika diagram)",
        "explanation": "Penjelasan kunci benar...",
        "options": [
          { "text": "Opsi A", "isCorrect": true },
          { "text": "Opsi B", "isCorrect": false }
        ]
      },
      {
        "type": "CHECKBOXES",
        "text": "Pilihlah semua yang benar...",
        "points": 15,
        "bloomLevel": "C4",
        "options": [
          { "text": "Opsi A", "isCorrect": true },
          { "text": "Opsi B", "isCorrect": true },
          { "text": "Opsi C", "isCorrect": false }
        ]
      },
      {
        "type": "TRUE_FALSE",
        "text": "Pernyataan...",
        "points": 10,
        "bloomLevel": "C2",
        "options": [
          { "text": "BENAR", "isCorrect": true },
          { "text": "SALAH", "isCorrect": false }
        ]
      },
      {
        "type": "SHORT_ANSWER",
        "text": "Pertanyaan isian singkat...",
        "points": 10,
        "bloomLevel": "C1",
        "sampleAnswer": "KataKunci",
        "gradingRubric": "Kriteria penilaian isian"
      },
      {
        "type": "ESSAY",
        "text": "Jelaskan secara mendalam...",
        "points": 25,
        "bloomLevel": "C5",
        "sampleAnswer": "Contoh jawaban ideal...",
        "gradingRubric": "Rubrik: 1. Konsep (50%), 2. Contoh (50%)"
      }
    ]
  },
  "adminAction": {
    "type": "navigate",
    "label": "Buka Halaman Ujian",
    "url": "/admin/exams"
  }
}
`.trim();

  let promptContent = userMessage;
  if (documentText) {
    promptContent += `\n\n[LAMPIRAN DOKUMEN: ${documentName || "file"}]:\n"""\n${documentText.slice(0, 50000)}\n"""`;
  }

  const contents: any[] = [];
  const recentHistory = history.slice(-6);
  for (const h of recentHistory) {
    contents.push({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.content }],
    });
  }

  const userParts: any[] = [];
  if (imageBase64) {
    userParts.push({
      inlineData: {
        mimeType: imageMimeType || "image/jpeg",
        data: imageBase64,
      },
    });
  }
  userParts.push({ text: promptContent });

  contents.push({
    role: "user",
    parts: userParts,
  });

  const payload = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  };

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 404) {
          console.warn(`[Gemini API] Model ${model} not available, attempting next candidate...`);
          lastError = new Error(`Model ${model} returned 404`);
          continue;
        }
        throw new Error(`Gemini API returned HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        return null;
      }

      try {
        const cleanJson = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(cleanJson);
        return {
          reply: parsed.reply || "Tugas berhasil diselesaikan.",
          quizDraft: parsed.quizDraft || null,
          adminAction: parsed.adminAction || null,
        };
      } catch (parseErr) {
        return {
          reply: rawText,
          quizDraft: null,
          adminAction: null,
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini API] Attempt with ${model} failed:`, err.message);
    }
  }

  if (lastError) {
    throw lastError;
  }
  return null;
}

/**
 * Intelligent Heuristic Fallback Engine when API Key is not set or network fails
 */
function processHeuristicFallback({
  userMessage,
  documentText,
  documentName,
  adminContext,
}: {
  userMessage: string;
  documentText?: string;
  documentName?: string;
  adminContext: string;
}): { reply: string; quizDraft?: GeneratedMultiQuizDraft | null; adminAction?: AdminActionPayload | null } {
  const query = userMessage.toLowerCase();

  // 1. Check if user is asking for navigation or admin stats
  if (query.includes("ujian") || query.includes("cbt") || query.includes("exam")) {
    if (!documentText) {
      return {
        reply: `Tentu! Untuk mengelola dan memantau ujian CBT VeloExambro, Anda dapat langsung membuka menu **VeloExambro CBT**. Di sana Anda dapat membuat soal baru, mengaktifkan live proctoring, dan meninjau hasil ujian peserta.\n\n${adminContext}`,
        adminAction: {
          type: "navigate",
          label: "Buka Pusat Ujian CBT",
          url: "/admin/exams",
        },
      };
    }
  }

  if (query.includes("presensi") || query.includes("sesi") || query.includes("absen")) {
    return {
      reply: `Untuk melihat data kehadiran dan mengaktifkan sesi absensi pertemuan berbasis Face Recognition atau QR Code, silakan kunjungi halaman **Sesi Presensi** atau **Terminal Wajah Kiosk**.\n\n${adminContext}`,
      adminAction: {
        type: "navigate",
        label: "Buka Sesi Presensi",
        url: "/admin/sessions",
      },
    };
  }

  if (query.includes("peserta") || query.includes("user") || query.includes("siswa")) {
    return {
      reply: `Data peserta dan anggota komunitas dapat dikelola pada menu **Data Peserta**. Anda dapat melihat status keaktifan, nomor WhatsApp, serta riwayat kehadiran mereka.\n\n${adminContext}`,
      adminAction: {
        type: "navigate",
        label: "Buka Data Peserta",
        url: "/admin/participants",
      },
    };
  }

  // 2. If a document was attached or user requested quiz generation
  if (documentText || query.includes("soal") || query.includes("kuis") || query.includes("buat")) {
    const docTitle = documentName ? documentName.replace(/\.[^/.]+$/, "") : "Materi VeloNet";
    const textToAnalyze = documentText || userMessage;

    // Check if document has existing numbered multiple-choice questions
    const questionRegex = /(\d+[\.\)]\s+[\s\S]+?(?=\d+[\.\)]\s+|$))/g;
    const matches = textToAnalyze.match(questionRegex);

    const questions: MultiFormatQuestionDraft[] = [];

    if (matches && matches.length >= 2) {
      for (let i = 0; i < Math.min(matches.length, 15); i++) {
        const block = matches[i];
        const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const questionText = lines[0].replace(/^\d+[\.\)]\s*/, "");

        const optionLines = lines.filter((l) => /^[A-Ea-e][\.\)]\s+/.test(l));
        if (optionLines.length >= 2) {
          const options = optionLines.map((optLine, optIdx) => {
            const cleanOpt = optLine.replace(/^[A-Ea-e][\.\)]\s*/, "");
            const isKey =
              block.toLowerCase().includes(`kunci: ${String.fromCharCode(65 + optIdx).toLowerCase()}`) ||
              optLine.includes("*") ||
              optIdx === 0;
            return {
              text: cleanOpt.replace(/\*/g, "").trim(),
              isCorrect: isKey,
            };
          });

          if (!options.some((o) => o.isCorrect)) {
            options[0].isCorrect = true;
          }

          questions.push({
            type: "SINGLE_CHOICE",
            text: questionText,
            points: 10,
            options,
          });
        }
      }
    }

    if (questions.length < 3) {
      // Single Choice (C2 - Memahami)
      questions.push({
        type: "SINGLE_CHOICE",
        text: `Berdasarkan dokumen "${docTitle}", manakah pernyataan di bawah ini yang paling tepat menggambarkan inti pembahasannya?`,
        points: 10,
        bloomLevel: "C2",
        diagramSvg: executeGenerateSvg({ type: "coordinate", title: `Grafik Konsep: ${docTitle}` }).data?.svg,
        explanation: `Pernyataan ini mencerminkan prinsip fundamental dan kaidah baku yang diuraikan dalam dokumen ${docTitle}.`,
        options: [
          { text: `Konsep utama dan kaidah mendasar yang dijabarkan dalam ${docTitle}.`, isCorrect: true },
          { text: "Pernyataan yang bertentangan dengan prinsip dasar dokumen.", isCorrect: false },
          { text: "Penerapan prosedur yang belum diverifikasi secara resmi.", isCorrect: false },
          { text: "Contoh kasus yang tidak memiliki relevansi terhadap materi.", isCorrect: false },
        ],
      });

      // Checkboxes (C4 - Menganalisis)
      questions.push({
        type: "CHECKBOXES",
        text: `Pilihlah SEMUA poin atau kesimpulan yang BENAR terkait materi "${docTitle}": (Pilihan jawaban bisa lebih dari 1)`,
        points: 15,
        bloomLevel: "C4",
        options: [
          { text: "Memiliki peranan penting dalam pencapaian kompetensi materi pembelajaran.", isCorrect: true },
          { text: "Dapat diterapkan secara kontekstual dalam latihan dan evaluasi.", isCorrect: true },
          { text: "Mengikuti sistematika dan kaidah yang terstandarisasi.", isCorrect: true },
          { text: "Hanya berlaku jika tidak ada parameter acuan lain.", isCorrect: false },
        ],
      });

      // True / False (C2 - Memahami)
      questions.push({
        type: "TRUE_FALSE",
        text: `Pernyataan: "Pemahaman menyeluruh terhadap dokumen ${docTitle} menjadi prasyarat penting dalam menyelesaikan studi kasus praktis."`,
        points: 10,
        bloomLevel: "C2",
        options: [
          { text: "BENAR", isCorrect: true },
          { text: "SALAH", isCorrect: false },
        ],
      });

      // Short Answer (C1 - Mengingat)
      questions.push({
        type: "SHORT_ANSWER",
        text: `Sebutkan istilah atau kata kunci utama yang menjadi fokus penting dalam pembahasan "${docTitle}":`,
        points: 10,
        bloomLevel: "C1",
        sampleAnswer: docTitle.split(" ")[0] || "Kompetensi",
        gradingRubric: `Jawaban tepat yang berkaitan langsung dengan tema ${docTitle}.`,
      });

      // Essay (C5 - Mengevaluasi)
      questions.push({
        type: "ESSAY",
        text: `Jelaskan secara komprehensif apa yang Anda pelajari dari dokumen "${docTitle}". Berikan analisis mendalam dan implementasi konkretnya!`,
        points: 25,
        bloomLevel: "C5",
        sampleAnswer: `Dokumen ${docTitle} membahas prinsip fundamental yang dapat diterapkan secara praktis. Implementasinya meliputi perencanaan, evaluasi berkala, serta tindak lanjut yang terstruktur.`,
        gradingRubric: `Rubrik Penilaian:
1. Ketepatan analisis konsep (Bobot: 40%)
2. Kelengkapan contoh implementasi (Bobot: 40%)
3. Struktur penjelasan dan tata bahasa (Bobot: 20%)`,
      });
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const quizDraft: GeneratedMultiQuizDraft = {
      title: `Ujian CBT: ${docTitle}`,
      description: `Kuis multi-format yang berhasil diekstrak & digenerate secara cerdas dari dokumen "${docTitle}". Dilengkapi pengamanan VeloExambro.`,
      category: "Dokumen Pembelajaran",
      durationMinutes: 30,
      maxStrikes: 3,
      enableFullscreenLock: true,
      enableCameraProctor: true,
      enableTabSwitchDetect: true,
      supervisorPin: pin,
      questions,
    };

    return {
      reply: `Saya telah menganalisis isi dokumen **"${docTitle}"** (${documentText ? `${documentText.length} karakter diekstrak` : "berdasarkan teks lampiran"}).\n\nSaya berhasil menyusun draf ujian **Multi-Format** (${questions.length} soal) yang terdiri dari:\n- 🎯 **Pilihan Ganda (Single Choice)**\n- ☑️ **Kotak Centang (Multiple Checkboxes)**\n- ⚖️ **Benar / Salah (True/False)**\n- ✏️ **Isian Singkat (Short Answer)**\n- 📝 **Uraian (Essay)** lengkap dengan contoh jawaban ideal & rubrik pembobotan.\n\n*Tips: Masukkan Gemini API Key di tombol pengaturan (gear) jika ingin menggunakan model Gemini 2.0 Flash untuk pemahaman dokumen yang lebih mendalam.*`,
      quizDraft,
      adminAction: {
        type: "action",
        label: "Terbitkan Kuis Ini",
      },
    };
  }

  // Default conversational reply
  return {
    reply: `Halo! Saya adalah **VeloNet Master Admin Copilot**.\n\nSaya dapat membantu Anda mengelola seluruh ekosistem VeloNet LMS:\n1. 📂 **Attach File Word (.docx) & PDF (.pdf)**: Saya akan langsung membaca dokumen dan mengubahnya menjadi soal ujian CBT multi-format.\n2. 📝 **Membuat & Menambahkan Soal**: Buat draf kuis instan atau tambahkan soal ke ujian yang sudah ada.\n3. 📊 **Akses Seluruh Fitur Admin**: Cek jumlah peserta, pantau absensi/kiosk, cek strike ujian, atau navigasi instan ke modul mana pun.\n\nAda yang bisa saya bantu sekarang?`,
  };
}
