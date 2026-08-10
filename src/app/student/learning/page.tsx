"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
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
  BookMarked,
  BrainCircuit,
  GraduationCap,
  FileText,
  Clock,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { MISTERGURU_MATERIALS, LearningMaterial } from "@/data/misterguru-data";

export default function StudentLearningPage() {
  const [materials, setMaterials] = useState<any[]>(MISTERGURU_MATERIALS);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMaterial, setActiveMaterial] = useState<any | null>(null);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<{ [qIndex: number]: number }>({});
  const [submittedQuiz, setSubmittedQuiz] = useState(false);

  const fetchScrapedArticles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/learning/articles");
      const json = await res.json();
      if (json.success && json.data) {
        setMaterials(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch scraped articles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScrapedArticles();
  }, []);

  const categories = [
    { id: "ALL", name: "📚 Semua Materi" },
    { id: "Grammar Guide", name: "📝 Grammar Guide" },
    { id: "TOEIC & Test Preps", name: "🎯 TOEIC & Test Preps" },
    { id: "Speaking & Dialogues", name: "💬 Speaking & Dialogues" },
    { id: "Text Genres", name: "📄 Text Genres" },
    { id: "Vocabulary Builder", name: "💡 Vocabulary Builder" },
  ];

  const filteredMaterials = materials.filter((item) => {
    const matchesCategory = selectedCategory === "ALL" || item.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      (item.summary && item.summary.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/20 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href="/student"
            className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold">
                MisterGuru Hub
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide mt-1 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-400" />
              <span>Bank Materi & Latihan Soal Bahasa Inggris</span>
            </h1>
          </div>
        </div>

        <div className="text-xs text-slate-400 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 max-w-xs">
          💡 <i>Materi dan latihan dikurasi langsung dari sumber edukasi terpercaya <b>MisterGuru.web.id</b>.</i>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="space-y-4">
        {/* Search Input */}
        <div className="p-3 rounded-2xl glass-panel border border-slate-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="Cari materi Grammar, TOEIC, Speaking, Vocabulary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 border border-blue-500/50"
                  : "bg-slate-900/80 hover:bg-slate-800 text-slate-400 border border-slate-800"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Materials Grid Card Listing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMaterials.map((item) => (
          <div
            key={item.id}
            onClick={() => handleOpenMaterial(item)}
            className="p-5 rounded-2xl glass-panel border border-slate-800 hover:border-blue-500/40 transition-all cursor-pointer group space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold">
                  {item.category}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {item.readTime}
                </span>
              </div>

              <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors leading-snug">
                {item.title}
              </h3>

              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {item.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  Level: {item.level}
                </span>
                {item.quiz && (
                  <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1">
                    <BrainCircuit className="w-3 h-3" />
                    {item.quiz.length} Soal Kuis
                  </span>
                )}
              </div>

              <span className="text-blue-400 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 text-xs">
                <span>Baca & Kuis</span>
                <ChevronRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Material Reading & Interactive Quiz Modal */}
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

            {/* Content Display */}
            <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-4 bg-slate-950/60 p-5 rounded-2xl border border-slate-800">
              {activeMaterial.contentHtml ? (
                <div
                  className="font-sans text-slate-200 space-y-3"
                  dangerouslySetInnerHTML={{ __html: activeMaterial.contentHtml }}
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
                    <span>Latihan Soal Kuis ({activeMaterial.quiz.length} Soal)</span>
                  </h3>

                  {submittedQuiz && (
                    <div className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>Skor Kuis Anda: {calculateQuizScore()}/100</span>
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
                Sumber Pembelajaran: <b>MisterGuru.web.id</b>
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
    </div>
  );
}
