"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import Link from "next/link";
import {
  BookOpen,
  Search,
  Sparkles,
  Award,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  BrainCircuit,
  GraduationCap,
  Clock,
  ChevronRight,
  Volume2,
  Share2,
  Zap,
  BookMarked,
  Filter,
  RefreshCw,
} from "lucide-react";
import { MISTERGURU_MATERIALS } from "@/data/misterguru-data";

export default function PublicMaterialsPage() {
  const [materials, setMaterials] = useState<any[]>(MISTERGURU_MATERIALS);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedLevel, setSelectedLevel] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMaterial, setActiveMaterial] = useState<any | null>(null);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<{ [qIndex: number]: number }>({});
  const [submittedQuiz, setSubmittedQuiz] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/learning/articles");
      const json = await res.json();
      if (json.success && json.data) {
        setMaterials(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch articles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const categories = [
    { id: "ALL", name: "📚 Semua Kategori" },
    { id: "Grammar Guide", name: "📝 Grammar Guide" },
    { id: "TOEIC & Test Preps", name: "🎯 TOEIC & Test Preps" },
    { id: "Speaking & Dialogues", name: "💬 Speaking & Dialogues" },
    { id: "Text Genres", name: "📄 Text Genres" },
    { id: "Vocabulary Builder", name: "💡 Vocabulary Builder" },
  ];

  const filteredMaterials = materials.filter((item) => {
    const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
    const matchesLevel = selectedLevel === "ALL" || item.level === selectedLevel;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.summary && item.summary.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q);

    return matchesCategory && matchesLevel && matchesSearch;
  });

  const handleOpenMaterial = (material: any) => {
    setActiveMaterial(material);
    setQuizAnswers({});
    setSubmittedQuiz(false);
  };

  const handleSelectQuizOption = (qIndex: number, optionIndex: number) => {
    if (submittedQuiz) return;
    setQuizAnswers((prev) => ({ ...prev, [qIndex]: optionIndex }));
  };

  const calculateQuizScore = () => {
    if (!activeMaterial?.quiz) return 0;
    let correctCount = 0;
    activeMaterial.quiz.forEach((q: any, idx: number) => {
      if (quizAnswers[idx] === q.answerIndex) {
        correctCount++;
      }
    });
    return Math.round((correctCount / activeMaterial.quiz.length) * 100);
  };

  // Text to Speech Audio Player
  const handleSpeak = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Browser Anda tidak mendukung Web Text-to-Speech.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    setSpeakingText(text);
    utterance.onend = () => setSpeakingText(null);
    utterance.onerror = () => setSpeakingText(null);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* Navigation Header */}
      <header className="max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between z-20 border-b border-slate-800/80">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            V
          </div>
          <div>
            <span className="font-extrabold text-xl text-white tracking-tight">
              Velocity <span className="text-blue-400">Learning Hub</span>
            </span>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              Free English Material & Quiz
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Beranda</span>
          </Link>

          <Link
            href="/student/login"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Portal Siswa</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto px-6 py-8 space-y-8 flex-1">
        {/* Hero Section */}
        <div className="text-center space-y-4 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[250px] bg-blue-600/15 blur-[100px] rounded-full pointer-events-none -z-10" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
            <GraduationCap className="w-4 h-4 text-blue-400" />
            <span>Bank Materi Resmi Powered by MisterGuru.web.id</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight max-w-3xl mx-auto">
            Kuasai Bahasa Inggris dengan{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
              Materi & Kuis Interaktif
            </span>
          </h1>

          <p className="text-slate-300 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Akses gratis ratusan materi Grammar, TOEIC Practice, Speaking Dialogues, & Vocabulary Builder lengkap dengan fitur audio pelafalan & latihan soal instan!
          </p>
        </div>

        {/* Filter & Search Bar Section */}
        <div className="p-5 rounded-3xl glass-panel border border-slate-800 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari materi (contoh: Tenses, Dialogue, TOEIC, Grammar)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded-md bg-slate-800"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Level Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full sm:w-auto bg-slate-950/80 border border-slate-800 rounded-2xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="ALL">Semua Level</option>
                <option value="Beginner">Beginner (Pemula)</option>
                <option value="Intermediate">Intermediate (Menengah)</option>
                <option value="Advanced">Advanced (Mahir)</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/60">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 border border-blue-500/50"
                    : "bg-slate-950/60 hover:bg-slate-800 text-slate-400 border border-slate-800"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Material Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
              Memuat bank materi & kuis Bahasa Inggris...
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs">
              Tidak ditemukan materi yang cocok dengan pencarian Anda.
            </div>
          ) : (
            filteredMaterials.map((item) => (
              <div
                key={item.id || item.slug}
                onClick={() => handleOpenMaterial(item)}
                className="p-5 rounded-3xl glass-panel border border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group space-y-4 flex flex-col justify-between hover:shadow-xl hover:shadow-blue-500/5"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold">
                      {item.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {item.readTime || "5 min read"}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {item.summary}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      {item.level}
                    </span>
                    {item.quiz && item.quiz.length > 0 && (
                      <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1">
                        <BrainCircuit className="w-3 h-3" />
                        {item.quiz.length} Kuis
                      </span>
                    )}
                  </div>

                  <span className="text-blue-400 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 text-xs">
                    <span>Mulai Belajar</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* CTA Join Community Banner */}
        <div className="p-8 rounded-3xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
          <div className="space-y-2 text-center sm:text-left z-10">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
              JOIN VELOCITY ENGLISH CLUB
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              Ingin Ikut Pertemuan Rutin & Absensi GPS?
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Daftarkan diri Anda di Komunitas Velocity melalui WhatsApp Bot dan dapatkan akses penuh ke Portal Siswa & Sertifikat Kehadiran!
            </p>
          </div>

          <Link
            href="/student/login"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 z-10"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Daftar / Login Portal Siswa</span>
          </Link>
        </div>
      </main>

      {/* Enhanced Material Reading & Quiz Reader Modal */}
      {activeMaterial && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold">
                    {activeMaterial.category}
                  </span>
                  <span className="text-xs text-slate-400">• Level {activeMaterial.level}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                  {activeMaterial.title}
                </h2>
              </div>

              <button
                onClick={() => setActiveMaterial(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Audio Text-to-Speech Player Control */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Volume2 className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Dengarkan pelafalan Bahasa Inggris (Audio Native TTS)</span>
              </div>

              <button
                onClick={() => handleSpeak(activeMaterial.summary || activeMaterial.title)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{speakingText ? "Memutar..." : "Putar Suara Audio"}</span>
              </button>
            </div>

            {/* Content Display */}
            <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
              {activeMaterial.contentHtml ? (
                <div
                  className="font-sans text-slate-200 space-y-3"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeMaterial.contentHtml) }}
                />
              ) : (
                <div className="whitespace-pre-wrap font-sans text-slate-200">
                  {activeMaterial.contentMarkdown}
                </div>
              )}
            </div>

            {/* Interactive Quiz Section */}
            {activeMaterial.quiz && activeMaterial.quiz.length > 0 && (
              <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-950 to-blue-950/30 border border-blue-500/30 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-amber-400" />
                    <span>Latihan Soal Kuis Interaktif ({activeMaterial.quiz.length} Soal)</span>
                  </h3>

                  {submittedQuiz && (
                    <div className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>Skor Anda: {calculateQuizScore()}/100</span>
                    </div>
                  )}
                </div>

                <div className="space-y-6 text-xs">
                  {activeMaterial.quiz.map((q: any, qIdx: number) => (
                    <div key={qIdx} className="space-y-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
                      <p className="font-semibold text-white">
                        {qIdx + 1}. {q.question}
                      </p>

                      <div className="space-y-2">
                        {q.options.map((opt: string, optIdx: number) => {
                          const isSelected = quizAnswers[qIdx] === optIdx;
                          const isCorrectOption = optIdx === q.answerIndex;

                          let btnStyle = "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700";
                          if (submittedQuiz) {
                            if (isCorrectOption) {
                              btnStyle = "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold";
                            } else if (isSelected && !isCorrectOption) {
                              btnStyle = "bg-rose-500/20 border-rose-500 text-rose-300 font-semibold";
                            }
                          } else if (isSelected) {
                            btnStyle = "bg-blue-500/20 border-blue-500 text-blue-300 font-semibold";
                          }

                          return (
                            <button
                              key={optIdx}
                              onClick={() => handleSelectQuizOption(qIdx, optIdx)}
                              className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${btnStyle}`}
                            >
                              <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                              {submittedQuiz && isCorrectOption && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              )}
                              {submittedQuiz && isSelected && !isCorrectOption && (
                                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation Note after submit */}
                      {submittedQuiz && (
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                          <p className="font-bold text-amber-400 flex items-center gap-1">
                            <HelpCircle className="w-3.5 h-3.5" /> Pembahasan:
                          </p>
                          <p>{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {!submittedQuiz ? (
                  <button
                    onClick={() => setSubmittedQuiz(true)}
                    disabled={Object.keys(quizAnswers).length === 0}
                    className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Periksa Jawaban & Tampilkan Skor</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setQuizAnswers({});
                      setSubmittedQuiz(false);
                    }}
                    className="w-full py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition-all cursor-pointer"
                  >
                    <span>Coba Kuis Lagi</span>
                  </button>
                )}
              </div>
            )}

            {/* External Attribution Footer */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-800">
              <span className="flex items-center gap-1 text-[11px]">
                <GraduationCap className="w-4 h-4 text-blue-400" />
                Sumber Edukasi: <b>MisterGuru.web.id</b>
              </span>

              <a
                href={activeMaterial.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline inline-flex items-center gap-1 text-[11px] font-semibold"
              >
                <span>Buka Artikel Asli</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 mt-12">
        <p>© 2026 Velocity English Community • MisterGuru Educational Library.</p>
      </footer>
    </div>
  );
}
