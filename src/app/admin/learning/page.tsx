"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  BookOpen,
  BrainCircuit,
  Settings2,
  CheckCircle2,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldAlert,
  Clock,
  KeyRound,
  Send,
  Plus,
  Trash2,
  Edit3,
  ChevronRight,
  Sliders,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import Pagination from "@/components/ui/Pagination";

export default function AdminAILearningAssistantPage() {
  const router = useRouter();
  const { toast, confirm } = useDialog();

  // Active Tab: 'GENERATOR' or 'KNOWLEDGE_BASE'
  const [activeTab, setActiveTab] = useState<"GENERATOR" | "KNOWLEDGE_BASE">("GENERATOR");

  // Knowledge Base State
  const [materials, setMaterials] = useState<any[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [syncing, setSyncing] = useState(false);

  // KB Pagination State
  const [kbPage, setKbPage] = useState(1);
  const [kbPageSize, setKbPageSize] = useState<number | "ALL">(10);

  // Generator Config Form State
  const [sourceType, setSourceType] = useState<"KNOWLEDGE_BASE" | "CUSTOM">("KNOWLEDGE_BASE");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [customTopic, setCustomTopic] = useState<string>("");
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<"Beginner" | "Intermediate" | "Advanced">("Intermediate");
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [pointsPerQuestion, setPointsPerQuestion] = useState<number>(10);

  // AI Generation State
  const [generating, setGenerating] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<any>(null);
  const [savingQuiz, setSavingQuiz] = useState(false);

  // Fetch Knowledge Base Materials
  const fetchKnowledgeBase = async () => {
    setLoadingMaterials(true);
    try {
      const res = await fetch("/api/admin/ai/knowledge-base");
      const json = await res.json();
      if (json.success && json.data) {
        setMaterials(json.data);
        if (json.data.length > 0 && !selectedTopicId) {
          setSelectedTopicId(json.data[0].id);
        }
      }
    } catch (err) {
      toast.error("Gagal memuat Knowledge Base.");
    } finally {
      setLoadingMaterials(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeBase();
  }, []);

  // Sync / Refresh Knowledge Base from MisterGuru
  const handleSyncKnowledgeBase = async () => {
    const ok = await confirm({
      title: "Sinkronisasi Pustaka Referensi AI",
      message: "Perbarui dan sinkronkan bank materi dari MisterGuru.web.id untuk memperluas database pengetahuan AI Assistant?",
      variant: "info",
      confirmText: "Ya, Sinkronkan",
      cancelText: "Batal",
    });

    if (!ok) return;

    setSyncing(true);
    toast.info("Menyinkronkan bank pengetahuan AI...");
    try {
      const res = await fetch("/api/learning/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20 }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Database diperbarui: ${json.totalScraped} materi tersimpan! 🎉`);
        fetchKnowledgeBase();
      } else {
        toast.error(json.error || "Gagal menyinkronkan data.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setSyncing(false);
    }
  };

  // Trigger AI Question Generation
  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();

    if (sourceType === "CUSTOM" && !customTopic.trim()) {
      toast.warning("Silakan masukkan topik materi kustom.");
      return;
    }

    if (sourceType === "KNOWLEDGE_BASE" && !selectedTopicId) {
      toast.warning("Silakan pilih salah satu materi dari Knowledge Base.");
      return;
    }

    setGenerating(true);
    toast.info("AI Assistant sedang menganalisis materi & menyusun soal CBT...");

    try {
      const res = await fetch("/api/admin/ai/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: sourceType === "KNOWLEDGE_BASE" ? selectedTopicId : undefined,
          customTopic: sourceType === "CUSTOM" ? customTopic.trim() : undefined,
          questionCount,
          difficulty,
          pointsPerQuestion,
          durationMinutes,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setGeneratedQuiz(json.data);
        toast.success(json.message || "Soal berhasil di-generate!");
      } else {
        toast.error(json.error || "Gagal meng-generate soal.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat memproses AI.");
    } finally {
      setGenerating(false);
    }
  };

  // Quick action from Knowledge Base tab: Select topic and switch to Generator tab
  const handleSelectTopicForGeneration = (topicId: string) => {
    setSelectedTopicId(topicId);
    setSourceType("KNOWLEDGE_BASE");
    setActiveTab("GENERATOR");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Save Generated Quiz into CBT / VeloExambro
  const handleSaveToCBT = async () => {
    if (!generatedQuiz || !generatedQuiz.questions?.length) return;

    const ok = await confirm({
      title: "Publikasikan ke VeloExambro CBT",
      message: `Terbitkan kuis "${generatedQuiz.title}" (${generatedQuiz.questions.length} soal) ke sistem ujian CBT VeloExambro? Siswa dapat langsung mengerjakannya dengan pengamanan anti-kecurangan.`,
      variant: "success",
      confirmText: "Ya, Terbitkan Kuis",
      cancelText: "Periksa Lagi",
    });

    if (!ok) return;

    setSavingQuiz(true);
    try {
      const res = await fetch("/api/admin/ai/save-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generatedQuiz),
      });

      const json = await res.json();
      if (json.success && json.data) {
        toast.success("Kuis CBT berhasil diterbitkan! Membuka halaman ujian...");
        router.push(`/admin/exams/${json.data.quizId}/proctor`);
      } else {
        toast.error(json.error || "Gagal menyimpan kuis.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat menyimpan kuis.");
    } finally {
      setSavingQuiz(false);
    }
  };

  // Filtered Knowledge Base
  const filteredMaterials = materials.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      m.title.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      (m.summary && m.summary.toLowerCase().includes(q))
    );
  });

  const kbTotal = filteredMaterials.length;
  const kbTotalPages = kbPageSize === "ALL" ? 1 : Math.ceil(kbTotal / kbPageSize) || 1;
  const paginatedMaterials =
    kbPageSize === "ALL"
      ? filteredMaterials
      : filteredMaterials.slice((kbPage - 1) * kbPageSize, kbPage * kbPageSize);

  return (
    <div className="space-y-6 text-slate-900 pb-24">
      {/* 1. TOP HERO BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AI Question Bank Assistant</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Asisten AI Pembuat Soal CBT & Ujian
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            Rancang dan terbitkan soal ujian CBT berstandar tinggi secara instan. Menggunakan basis pengetahuan <b>MisterGuru</b> untuk menghasilkan soal tata bahasa, reading, dan kuis interaktif yang siap diujikan di VeloExambro.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 self-start sm:self-auto">
          <Link
            href="/admin/exams"
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/15 flex items-center gap-2"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Pusat Ujian CBT</span>
          </Link>
        </div>
      </div>

      {/* 2. NAVIGATION TABS */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-200/80 w-fit">
        <button
          onClick={() => setActiveTab("GENERATOR")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "GENERATOR"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>✨ Generator Soal AI</span>
        </button>

        <button
          onClick={() => setActiveTab("KNOWLEDGE_BASE")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "KNOWLEDGE_BASE"
              ? "bg-white text-blue-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span>📚 Knowledge Base ({materials.length} Materi)</span>
        </button>
      </div>

      {/* 3. TAB 1: AI QUIZ GENERATOR WORKSPACE */}
      {activeTab === "GENERATOR" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Generator Form (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={handleGenerateQuiz}
              className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-blue-600" />
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Parameter Asisten AI
                  </h3>
                </div>
              </div>

              {/* Source Type Toggle */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  Sumber Referensi Materi
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSourceType("KNOWLEDGE_BASE")}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      sourceType === "KNOWLEDGE_BASE"
                        ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Database MisterGuru</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSourceType("CUSTOM")}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      sourceType === "CUSTOM"
                        ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Topik Kustom</span>
                  </button>
                </div>
              </div>

              {/* Knowledge Base Topic Picker */}
              {sourceType === "KNOWLEDGE_BASE" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Pilih Materi dari Knowledge Base
                  </label>
                  {loadingMaterials ? (
                    <div className="p-3 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                      Memuat daftar materi...
                    </div>
                  ) : (
                    <select
                      value={selectedTopicId}
                      onChange={(e) => setSelectedTopicId(e.target.value)}
                      className="w-full px-3.5 py-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium outline-hidden"
                    >
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          [{m.category}] {m.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Topik / Konsep Materi yang Ingin Diuji
                  </label>
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="Misal: Conditional Sentences Type 1, 2, 3..."
                    className="w-full px-4 py-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 outline-hidden"
                  />
                </div>
              )}

              {/* Question Count & Difficulty */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Jumlah Soal
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium outline-hidden"
                  >
                    <option value={5}>5 Soal (Mini Kuis)</option>
                    <option value={10}>10 Soal (Standar)</option>
                    <option value={15}>15 Soal (Latihan Bab)</option>
                    <option value={20}>20 Soal (Ujian Penuh)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Tingkat Kesulitan
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium outline-hidden"
                  >
                    <option value="Beginner">Beginner (Dasar)</option>
                    <option value="Intermediate">Intermediate (Menengah)</option>
                    <option value="Advanced">Advanced (Mahir)</option>
                  </select>
                </div>
              </div>

              {/* Duration & Points */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Durasi Pengerjaan
                  </label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium outline-hidden"
                  >
                    <option value={15}>15 Menit</option>
                    <option value={30}>30 Menit</option>
                    <option value={45}>45 Menit</option>
                    <option value={60}>60 Menit</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Poin per Soal
                  </label>
                  <select
                    value={pointsPerQuestion}
                    onChange={(e) => setPointsPerQuestion(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 text-slate-900 font-medium outline-hidden"
                  >
                    <option value={5}>5 Poin</option>
                    <option value={10}>10 Poin</option>
                    <option value={20}>20 Poin</option>
                  </select>
                </div>
              </div>

              {/* Generate Button */}
              <button
                type="submit"
                disabled={generating}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>AI Sedang Menyusun Soal...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>✨ Generate Soal Ujian dengan AI</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: AI Generated Quiz Preview & Publish (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            {!generatedQuiz ? (
              <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center flex flex-col items-center justify-center space-y-4 shadow-sm min-h-[420px]">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
                  <BrainCircuit className="w-8 h-8" />
                </div>
                <div className="max-w-sm space-y-1">
                  <h3 className="font-bold text-slate-900 text-base">
                    Belum Ada Soal yang Di-generate
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Pilih materi dari Knowledge Base di sebelah kiri, lalu klik <b>"Generate Soal Ujian dengan AI"</b> untuk melihat draf soal CBT secara instan.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Header of Generated Quiz */}
                <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Draf AI Siap ({generatedQuiz.questions?.length} Soal)</span>
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-900 mt-1">
                      {generatedQuiz.title}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">{generatedQuiz.description}</p>
                  </div>

                  <button
                    onClick={handleSaveToCBT}
                    disabled={savingQuiz}
                    className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {savingQuiz ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Menerbitkan...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>🚀 Terbitkan ke VeloExambro</span>
                      </>
                    )}
                  </button>
                </div>

                {/* List of Questions Preview */}
                <div className="space-y-4">
                  {generatedQuiz.questions.map((q: any, qIdx: number) => (
                    <div
                      key={qIdx}
                      className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4 text-xs"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-[11px] flex items-center justify-center">
                            {qIdx + 1}
                          </span>
                          <span className="font-bold text-slate-800">
                            Pertanyaan #{qIdx + 1}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          {q.points} Poin
                        </span>
                      </div>

                      <p className="font-bold text-slate-900 text-sm leading-relaxed whitespace-pre-line">
                        {q.text}
                      </p>

                      {/* Options */}
                      <div className="space-y-2 pt-1">
                        {q.options.map((opt: any, optIdx: number) => {
                          const letter = String.fromCharCode(65 + optIdx);
                          return (
                            <div
                              key={optIdx}
                              className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                                opt.isCorrect
                                  ? "bg-emerald-50/80 border-emerald-400 text-emerald-950 font-bold ring-1 ring-emerald-400/40"
                                  : "bg-slate-50 border-slate-200 text-slate-700"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                                    opt.isCorrect
                                      ? "bg-emerald-600 text-white"
                                      : "bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  {letter}
                                </span>
                                <span>{opt.text}</span>
                              </div>
                              {opt.isCorrect && (
                                <span className="text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                                  Kunci Jawaban
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {q.explanation && (
                        <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                          <strong>💡 Pembahasan AI:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB 2: KNOWLEDGE BASE BROWSER & MANAGEMENT */}
      {activeTab === "KNOWLEDGE_BASE" && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Pustaka Referensi Materi MisterGuru ({filteredMaterials.length} Materi)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Basis pengetahuan yang digunakan oleh AI Assistant untuk menyusun soal ujian CBT.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Cari materi referensi..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>

              {/* Sync Button */}
              <button
                onClick={handleSyncKnowledgeBase}
                disabled={syncing}
                className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                title="Perbarui basis data dari MisterGuru.web.id"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                <span>Sync Pustaka</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Judul Materi</th>
                  <th className="py-3.5 px-4">Kategori</th>
                  <th className="py-3.5 px-4">Level</th>
                  <th className="py-3.5 px-4">Sumber Asli</th>
                  <th className="py-3.5 px-4 text-right">Aksi Asisten AI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loadingMaterials ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                      Memuat data knowledge base...
                    </td>
                  </tr>
                ) : filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Tidak ada materi yang cocok dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedMaterials.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 max-w-sm truncate">
                        {m.title}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                          {m.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-600">
                        {m.level}
                      </td>
                      <td className="py-3.5 px-4">
                        <a
                          href={m.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[11px]"
                        >
                          <span>MisterGuru</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleSelectTopicForGeneration(m.id)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          <span>Generate Soal</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="border-t border-slate-100 bg-slate-50/50 px-2 rounded-2xl">
            <Pagination
              currentPage={kbPage}
              totalPages={kbTotalPages}
              totalItems={kbTotal}
              pageSize={kbPageSize}
              onPageChange={(newPage) => setKbPage(newPage)}
              onPageSizeChange={(newSize) => {
                setKbPageSize(newSize);
                setKbPage(1);
              }}
              itemLabel="materi referensi"
              isLoading={loadingMaterials}
            />
          </div>
        </div>
      )}
    </div>
  );
}
