"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import Link from "next/link";
import {
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
  Filter,
  RefreshCw,
} from "lucide-react";
import { MISTERGURU_MATERIALS } from "@/data/misterguru-data";
import { useDialog } from "@/components/ui/DialogProvider";

export default function PublicMaterialsPage() {
  const { toast } = useDialog();
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
      toast.warning("Browser Anda tidak mendukung Web Text-to-Speech.");
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <header className="max-w-7xl w-full mx-auto px-6 py-5 flex items-center justify-between z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
            V
          </div>
          <div>
            <span className="font-extrabold text-xl text-slate-900 tracking-tight">
              Velocity <span className="text-blue-600">Learning Hub</span>
            </span>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
              Free English Material & Quiz
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all border border-slate-200 shadow-xs"
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
      <main className="max-w-6xl w-full mx-auto px-6 py-10 space-y-8 flex-1">
        {/* Hero Section */}
        <div className="text-center space-y-4 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[250px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none -z-10" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold shadow-xs">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <span>Bank Materi Resmi Powered by MisterGuru.web.id</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight max-w-3xl mx-auto">
            Kuasai Bahasa Inggris dengan{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
              Materi & Kuis Interaktif
            </span>
          </h1>

          <p className="text-slate-600 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Akses gratis ratusan materi Grammar, TOEIC Practice, Speaking Dialogues, & Vocabulary Builder lengkap dengan fitur audio pelafalan & latihan soal instan!
          </p>
        </div>

        {/* Filter & Search Bar Section */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari materi (contoh: Tenses, Dialogue, TOEIC, Grammar)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-800 px-2 py-0.5 rounded-md bg-slate-200 hover:bg-slate-300"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Level Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
              >
                <option value="ALL">Semua Level</option>
                <option value="Beginner">Beginner (Pemula)</option>
                <option value="Intermediate">Intermediate (Menengah)</option>
                <option value="Advanced">Advanced (Mahir)</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-600"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
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
            <div className="col-span-full py-12 text-center text-slate-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
              Memuat bank materi & kuis Bahasa Inggris...
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 text-xs bg-white rounded-3xl border border-slate-200 p-8">
              Tidak ditemukan materi yang cocok dengan pencarian Anda.
            </div>
          ) : (
            filteredMaterials.map((item) => (
              <div
                key={item.id || item.slug}
                onClick={() => handleOpenMaterial(item)}
                className="p-5 rounded-3xl bg-white border border-slate-200/90 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group space-y-4 flex flex-col justify-between shadow-xs"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold">
                      {item.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {item.readTime || "5 min read"}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {item.summary}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {item.level}
                    </span>
                    {item.quiz && item.quiz.length > 0 && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                        <BrainCircuit className="w-3 h-3" />
                        {item.quiz.length} Kuis
                      </span>
                    )}
                  </div>

                  <span className="text-blue-600 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 text-xs">
                    <span>Mulai Belajar</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* CTA Join Community Banner */}
        <div className="p-8 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-700 border border-blue-400/30 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden text-white">
          <div className="space-y-2 text-center sm:text-left z-10">
            <span className="px-3 py-1 rounded-full bg-white/20 text-white border border-white/30 text-xs font-bold">
              JOIN VELOCITY ENGLISH CLUB
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              Ingin Ikut Pertemuan Rutin & Absensi GPS?
            </h2>
            <p className="text-xs text-blue-100 max-w-xl">
              Daftarkan diri Anda di Komunitas Velocity melalui WhatsApp Bot dan dapatkan akses penuh ke Portal Siswa & Sertifikat Kehadiran!
            </p>
          </div>

          <Link
            href="/student/login"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-blue-700 font-bold text-xs shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 z-10"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Daftar / Login Portal Siswa</span>
          </Link>
        </div>
      </main>

      {/* Enhanced Material Reading & Quiz Reader Modal */}
      {activeMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto text-slate-900">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
                    {activeMaterial.category}
                  </span>
                  <span className="text-xs text-slate-500">• Level {activeMaterial.level}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-wide">
                  {activeMaterial.title}
                </h2>
              </div>

              <button
                onClick={() => setActiveMaterial(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors shrink-0 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Audio Text-to-Speech Player Control */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Volume2 className="w-4 h-4 text-blue-600 shrink-0" />
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
            <div className="prose max-w-none text-xs leading-relaxed space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
              {activeMaterial.contentHtml ? (
                <div
                  className="font-sans text-slate-800 space-y-3"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeMaterial.contentHtml) }}
                />
              ) : (
                <div className="whitespace-pre-wrap font-sans text-slate-800">
                  {activeMaterial.contentMarkdown}
                </div>
              )}
            </div>

            {/* Interactive Quiz Section */}
            {activeMaterial.quiz && activeMaterial.quiz.length > 0 && (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-amber-500" />
                    <span>Latihan Soal Kuis Interaktif ({activeMaterial.quiz.length} Soal)</span>
                  </h3>

                  {submittedQuiz && (
                    <div className="px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Skor Anda: {calculateQuizScore()}/100</span>
                    </div>
                  )}
                </div>

                <div className="space-y-6 text-xs">
                  {activeMaterial.quiz.map((q: any, qIdx: number) => (
                    <div key={qIdx} className="space-y-3 p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
                      <p className="font-semibold text-slate-900">
                        {qIdx + 1}. {q.question}
                      </p>

                      <div className="space-y-2">
                        {q.options.map((opt: string, optIdx: number) => {
                          const isSelected = quizAnswers[qIdx] === optIdx;
                          const isCorrectOption = optIdx === q.answerIndex;

                          let btnStyle = "bg-slate-50 border-slate-200 text-slate-800 hover:bg-blue-50/60 hover:border-blue-200";
                          if (submittedQuiz) {
                            if (isCorrectOption) {
                              btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold ring-1 ring-emerald-500/30";
                            } else if (isSelected && !isCorrectOption) {
                              btnStyle = "bg-rose-50 border-rose-500 text-rose-900 font-semibold ring-1 ring-rose-500/30";
                            }
                          } else if (isSelected) {
                            btnStyle = "bg-blue-50 border-blue-500 text-blue-900 font-semibold ring-1 ring-blue-500/30";
                          }

                          return (
                            <button
                              key={optIdx}
                              onClick={() => handleSelectQuizOption(qIdx, optIdx)}
                              className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${btnStyle}`}
                            >
                              <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                              {submittedQuiz && isCorrectOption && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              )}
                              {submittedQuiz && isSelected && !isCorrectOption && (
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation Note after submit */}
                      {submittedQuiz && (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
                          <p className="font-bold text-amber-800 flex items-center gap-1">
                            <HelpCircle className="w-3.5 h-3.5 text-amber-600" /> Pembahasan:
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
                    className="w-full py-3 px-6 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-300 transition-all cursor-pointer shadow-xs"
                  >
                    <span>Coba Kuis Lagi</span>
                  </button>
                )}
              </div>
            )}

            {/* External Attribution Footer */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-200">
              <span className="flex items-center gap-1 text-[11px]">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                Sumber Edukasi: <b>MisterGuru.web.id</b>
              </span>

              <a
                href={activeMaterial.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[11px] font-semibold"
              >
                <span>Buka Artikel Asli</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12 bg-white/50">
        <p>© 2026 Velocity English Community • MisterGuru Educational Library.</p>
      </footer>
    </div>
  );
}
