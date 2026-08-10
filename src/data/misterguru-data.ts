export interface LearningMaterial {
  id: string;
  title: string;
  category: "Grammar Guide" | "TOEIC & Test Preps" | "Speaking & Dialogues" | "Text Genres" | "Vocabulary Builder";
  level: "Beginner" | "Intermediate" | "Advanced";
  readTime: string;
  sourceUrl: string;
  summary: string;
  contentMarkdown: string;
  quiz?: {
    question: string;
    options: string[];
    answerIndex: number;
    explanation: string;
  }[];
}

export const MISTERGURU_MATERIALS: LearningMaterial[] = [
  {
    id: "degrees-of-comparison",
    title: "Degrees of Comparison: Positive, Comparative, Superlative, & Parallel Increase",
    category: "Grammar Guide",
    level: "Beginner",
    readTime: "5 min read",
    sourceUrl: "https://www.misterguru.web.id/2013/06/degrees-of-comparison-positive.html",
    summary: "Panduan lengkap penggunaan Degrees of Comparison untuk membandingkan kata sifat (adjective) dalam Bahasa Inggris.",
    contentMarkdown: `
### 📌 1. Positive Degree (Sama/Setara)
Menggunakan rumus: **as + adjective + as**
- *Example:* "Rina is **as tall as** Sinta." (Rina sama tingginya dengan Sinta.)
- *Example:* "English is **as important as** Mathematics."

---

### 📌 2. Comparative Degree (Lebih ...)
Digunakan untuk membandingkan 2 hal:
- Untuk 1 suku kata (1 syllable): **adjective + -er + than**
  - *Example:* "Fast" ➔ "Faster than" (*"A train is **faster than** a bus."*)
- Untuk 2+ suku kata (2+ syllables): **more + adjective + than**
  - *Example:* "Expensive" ➔ "More expensive than" (*"This laptop is **more expensive than** that phone."*)

---

### 📌 3. Superlative Degree (Paling ...)
Digunakan untuk membandingkan 3 hal atau lebih:
- Untuk 1 suku kata: **the + adjective + -est**
  - *Example:* "Short" ➔ "The shortest" (*"Riko is **the shortest** student in the class."*)
- Untuk 2+ suku kata: **the most + adjective**
  - *Example:* "Popular" ➔ "The most popular" (*"Velocity is **the most popular** English club in school!"*)

---

### 💡 Special Pattern: Parallel Increase (The ..., The ...)
- *Pattern:* **The [comparative], the [comparative]**
- *Example:* "**The more** you practice English, **the better** you speak!"
`,
    quiz: [
      {
        question: "Bentuk comparative dari kata sifat 'beautiful' yang benar adalah...",
        options: ["Beautifuler than", "More beautiful than", "The most beautiful", "As beautiful"],
        answerIndex: 1,
        explanation: "'Beautiful' memiliki lebih dari 2 suku kata, sehingga menggunakan 'more beautiful than'.",
      },
      {
        question: "Lengkapi kalimat: 'The harder you study, _____ your score will be.'",
        options: ["the good", "the better", "more good", "the best"],
        answerIndex: 1,
        explanation: "Pola Parallel Increase menggunakan 'The [comparative], the [comparative]'. Comparative dari good adalah 'better'.",
      },
    ],
  },
  {
    id: "toeic-professional-reading",
    title: "Professional English Series: Modern Workforce & Technical Reading Practice",
    category: "TOEIC & Test Preps",
    level: "Advanced",
    readTime: "8 min read",
    sourceUrl: "https://www.misterguru.web.id/2026/02/professional-english-series-reading-practice.html",
    summary: "Latihan soal Reading SMK/SMA persiapan tes VIERA, TOEIC & Ujian Sekolah TKA topik Modern Industry & Career.",
    contentMarkdown: `
### 🛠️ Industry 4.0 Key Vocabulary & Expressions

#### 📞 Professional Telephoning
- **Answering:** *"Good morning, Velocity Company, this is Budi speaking. How can I help you?"*
- **Asking for someone:** *"Could I speak to Mr. Aris from the IT Department, please?"*
- **Putting someone on hold:** *"One moment, please. I'll see if they are available."*

#### 🤝 Receiving Guests & Clients
- **Greeting:** *"Welcome to our office. Do you have an appointment?"*
- **Asking identity:** *"May I have your name and the name of your organization, please?"*
- **Giving directions:** *"Please take a seat. I will inform the manager that you have arrived."*

#### 📝 Technical & IT Vocabulary
- **Regenerative:** Energy-saving / restoring energy.
- **Interference:** Signal disruption in physics or IT networks.
- **Proficient:** Highly skilled at a specific task or language.
- **Digital Fatigue:** Tiredness caused by excessive screen time.
`,
    quiz: [
      {
        question: "What is the polite phrase to ask for someone on the phone?",
        options: [
          "Where is Mr. Aris?",
          "Could I speak to Mr. Aris from the IT Department, please?",
          "Give me Mr. Aris right now.",
          "Is Mr. Aris there or not?",
        ],
        answerIndex: 1,
        explanation: "'Could I speak to...' adalah kalimat telepon formal yang paling sopan dalam standar bisnis.",
      },
      {
        question: "The word 'Proficient' in workplace English means...",
        options: ["Unskilled", "Highly skilled and competent", "Lazy", "Temporary"],
        answerIndex: 1,
        explanation: "'Proficient' berarti mahir atau sangat terampil dalam suatu tugas.",
      },
    ],
  },
  {
    id: "complimenting-congratulating",
    title: "Complimenting and Congratulating Someone: Example Dialogues & Phrases",
    category: "Speaking & Dialogues",
    level: "Intermediate",
    readTime: "6 min read",
    sourceUrl: "https://www.misterguru.web.id/2024/11/complimenting-and-congratulating.html",
    summary: "Cara memberikan pujian (compliment) dan ucapan selamat (congratulations) dalam bahasa Inggris secara alami.",
    contentMarkdown: `
### 👏 1. How to Give Compliments (Memberikan Pujian)
Gunakan frasa berikut untuk memuji penampilan, prestasi, atau barang seseorang:

- *"What a fantastic presentation, Sarah!"*
- *"You did a great job on the English project!"*
- *"I really love your new shoes, it looks awesome on you."*
- *"That's a very nice outfit!"*

#### Responses to Compliments:
- *"Thank you! I'm glad you liked it."*
- *"Thanks for the kind words!"*
- *"I appreciate it, thank you!"*

---

### 🎉 2. How to Congratulate Someone (Mengucapkan Selamat)
Gunakan saat seseorang mencapai prestasi besar (lulus, menang lomba, ulang tahun):

- *"Congratulations on winning the English Speech Contest!"*
- *"I'd like to congratulate you on your graduation!"*
- *"Happy Birthday! Wishing you all the best!"*

#### Responses to Congratulations:
- *"Thank you so much!"*
- *"Thanks! I couldn't have done it without your support."*
`,
    quiz: [
      {
        question: "Your friend just won 1st place in the English Olympiad. What should you say?",
        options: [
          "What a pity!",
          "Congratulations on winning 1st place! You deserve it!",
          "Never mind.",
          "You must be very tired.",
        ],
        answerIndex: 1,
        explanation: "Gunakan 'Congratulations on winning...' untuk memberikan ucapan selamat atas kemenangan.",
      },
    ],
  },
  {
    id: "analytical-expositions",
    title: "Analytical Exposition Text: Definition, Generic Structure, & Examples",
    category: "Text Genres",
    level: "Intermediate",
    readTime: "7 min read",
    sourceUrl: "https://www.misterguru.web.id/2024/12/analytical-expositions-example-texts.html",
    summary: "Penjelasan lengkap teks Analytical Exposition untuk membujuk pembaca bahwa suatu topik penting untuk dibahas.",
    contentMarkdown: `
### 📄 Definition & Purpose
Analytical Exposition adalah teks yang berisi pendapat penulis tentang suatu fenomena di sekitar kita. Tujuan utamanya adalah meyakinkan pembaca bahwa topik tersebut penting.

---

### 🏛️ Generic Structure (Struktur Teks)
1. **Thesis**: Memperkenalkan topik dan menyatakan sudut pandang/posisi penulis.
2. **Arguments**: Berisi alasan-alasan pendukung yang memperkuat pandangan penulis (biasanya terdiri dari beberapa paragraf).
3. **Reiteration / Conclusion**: Kesimpulan yang menguatkan kembali posisi penulis.

---

### 🔑 Language Features (Ciri Kebahasaan)
- Menggunakan **Simple Present Tense** (*"Education is vital for youth."*)
- Menggunakan **Internal Conjunctions** (*"Firstly, secondly, furthermore, in addition, however"*).
- Menggunakan **Evaluative Words** (*"Important, significant, crucial, dangerous"*).
`,
    quiz: [
      {
        question: "What is the main purpose of an Analytical Exposition text?",
        options: [
          "To entertain the readers with a story",
          "To persuade the reader that the topic is important to be discussed",
          "To describe a specific person or place",
          "To explain how to make something step by step",
        ],
        answerIndex: 1,
        explanation: "Tujuan Analytical Exposition adalah meyakinkan pembaca bahwa isu yang dibahas itu penting.",
      },
      {
        question: "The last paragraph of an Analytical Exposition text is called...",
        options: ["Thesis", "Orientation", "Reiteration / Conclusion", "Resolution"],
        answerIndex: 2,
        explanation: "Bagian penutup Analytical Exposition disebut Reiteration atau Conclusion.",
      },
    ],
  },
  {
    id: "workforce-vocabulary-builder",
    title: "Workforce 4.0 & Business English Vocabulary Builder",
    category: "Vocabulary Builder",
    level: "Intermediate",
    readTime: "5 min read",
    sourceUrl: "https://www.misterguru.web.id/search/label/Vocabulary%20Builder",
    summary: "Daftar kosakata penting bahasa Inggris dunia kerja, IT, dan komunikasi bisnis modern.",
    contentMarkdown: `
### 💼 Modern Business & Workplace Terms

| English Word | Meaning (Indonesian) | Example Sentence |
|---|---|---|
| **Correspondence** | Surat menyurat / Email bisnis | *"I handle all international email correspondence."* |
| **Ergonomics** | Kenyamanan posisi kerja | *"Ergonomic chairs prevent back pain."* |
| **Colleague** | Rekan kerja | *"My colleagues are very supportive."* |
| **Deadline** | Tenggat waktu | *"We must submit the report before the deadline."* |
| **Collaborate** | Bekerja sama | *"Let's collaborate on this presentation."* |

---

### 💡 Pro-Tip for English Learners
Catat setidaknya **3 kata baru setiap hari** dan buatlah kalimat sederhana menggunakan kata tersebut di kehidupan sehari-hari!
`,
    quiz: [
      {
        question: "What does 'Correspondence' mean in business English?",
        options: ["Bermain game", "Surat menyurat atau komunikasi email bisnis", "Makan siang", "Istirahat"],
        answerIndex: 1,
        explanation: "'Correspondence' mengacu pada komunikasi tertulis seperti surat atau email profesional.",
      },
    ],
  },
];
