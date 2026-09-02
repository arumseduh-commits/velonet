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
    { id: "ALL", name: "Semua Materi" },
    { id: "Grammar Guide", name: "Grammar Guide" },
    { id: "TOEIC & Test Preps", name: "TOEIC & Preps" },
    { id: "Speaking & Dialogues", name: "Speaking & Dialogues" },
    { id: "Text Genres", name: "Text Genres" },
    { id: "Vocabulary Builder", name: "Vocabulary" },
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
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-6 max-w-6xl mx-auto pb-24 md:pb-12">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50/40 to-white border border-blue-200/80 shadow-xs text-slate-900">
        <div className="flex items-center gap-3.5">
          <Link
            href="/student"
            className="p-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 transition-colors border border-slate-200 shadow-xs btn-press"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-xs font-semibold">
              MisterGuru Hub
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600" />
              <span>Bank Materi & Latihan</span>
            </h1>
          </div>
        </div>

        <div className="text-xs text-slate-500 bg-white/80 px-3.5 py-2 rounded-2xl border border-slate-200 shadow-xs self-start sm:self-auto">
          <span>Kurasi materi terpercaya MisterGuru</span>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="space-y-4">
        {/* Search Input */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="Cari materi Grammar, TOEIC, Speaking, Vocabulary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1 rounded-lg bg-slate-100"
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold btn-press transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? "bg-blue-600 text-white shadow-xs border border-blue-600 font-bold"
                  : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-xs"
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
            className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group space-y-3 flex flex-col justify-between text-slate-900 shadow-sm"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                  {item.category}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {item.readTime}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
                {item.title}
              </h3>

              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {item.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Level: {item.level}
                </span>
                {item.quiz && (
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                    <BrainCircuit className="w-3 h-3 text-amber-600" />
                    {item.quiz.length} Soal Kuis
                  </span>
                )}
              </div>

              <span className="text-blue-600 font-semibold group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 text-xs">
                <span>Baca & Kuis</span>
                <ChevronRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Material Reading & Interactive Quiz Modal */}
      {activeMaterial && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto text-slate-900">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
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
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors shrink-0 cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Content Display */}
            <div className="prose prose-slate max-w-none text-xs leading-relaxed space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
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
              <div className="p-6 rounded-2xl bg-gradient-to-b from-blue-50/50 to-white border border-blue-200 space-y-5 text-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-amber-500" />
                    <span>Latihan Soal Kuis ({activeMaterial.quiz.length} Soal)</span>
                  </h3>

                  {submittedQuiz && (
                    <div className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Skor Kuis Anda: {calculateQuizScore()}/100</span>
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

                          let btnStyle = "bg-slate-50 border-slate-200 text-slate-700 hover:bg-blue-50/60 hover:border-blue-300";
                          if (submittedQuiz) {
                            if (isCorrectOption) {
                              btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold";
                            } else if (isSelected && !isCorrectOption) {
                              btnStyle = "bg-rose-50 border-rose-500 text-rose-800 font-semibold";
                            }
                          } else if (isSelected) {
                            btnStyle = "bg-blue-50 border-blue-500 text-blue-800 font-semibold shadow-xs";
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
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
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
                    className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
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
                    className="w-full py-3 px-6 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-all cursor-pointer"
                  >
                    <span>Coba Kuis Lagi</span>
                  </button>
                )}
              </div>
            )}

            {/* External Attribution Footer */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-100">
              <span className="flex items-center gap-1 text-[11px]">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                Sumber Pembelajaran: <b>MisterGuru.web.id</b>
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
    </div>
  );
}
