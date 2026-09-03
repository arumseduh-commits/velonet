"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  User,
  Clock,
  BookOpen,
  Award,
  Edit3,
  Send,
  HelpCircle,
  AlertTriangle,
  FileText,
  BarChart3,
  Brain,
  X,
  Check,
  Zap,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

export default function ExamEssayGradingPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = params.quizId as string;
  const { toast, confirm } = useDialog();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null);

  // Batch states
  const [batchGrading, setBatchGrading] = useState(false);
  const [batchApproving, setBatchApproving] = useState(false);

  // Remedial Analysis Modal states
  const [showRemedialModal, setShowRemedialModal] = useState(false);
  const [loadingRemedial, setLoadingRemedial] = useState(false);
  const [remedialData, setRemedialData] = useState<any>(null);
  const [publishingRemedial, setPublishingRemedial] = useState(false);

  // Form states for manual score and feedback
  const [teacherScores, setTeacherScores] = useState<{ [answerId: string]: number }>({});
  const [teacherFeedbacks, setTeacherFeedbacks] = useState<{ [answerId: string]: string }>({});

  const fetchGradingData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/exams/${quizId}/grading`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);

        // Pre-fill existing scores
        const initialScores: any = {};
        const initialFeedbacks: any = {};
        json.data.attempts?.forEach((att: any) => {
          att.answers?.forEach((ans: any) => {
            initialScores[ans.id] = ans.teacherScore ?? ans.aiSuggestedScore ?? ans.earnedPoints ?? 0;
            initialFeedbacks[ans.id] = ans.teacherFeedback ?? ans.aiEvaluationFeedback ?? "";
          });
        });
        setTeacherScores(initialScores);
        setTeacherFeedbacks(initialFeedbacks);
      } else {
        toast.error("Gagal memuat data penilaian kuis.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGradingData();
  }, [quizId]);

  // Submit Grade for single answer
  const handleSaveGrade = async (
    attemptId: string,
    answerId: string,
    approveAIScore = false
  ) => {
    setSavingAnswerId(answerId);
    try {
      const res = await fetch(`/api/admin/exams/${quizId}/grade-essay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          answerId,
          teacherScore: teacherScores[answerId],
          teacherFeedback: teacherFeedbacks[answerId],
          approveAIScore,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Nilai berhasil disimpan!");
        fetchGradingData();
      } else {
        toast.error(json.error || "Gagal menyimpan nilai.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan server saat menyimpan nilai.");
    } finally {
      setSavingAnswerId(null);
    }
  };

  // Batch AI Grading
  const handleBatchAIGrading = async () => {
    const confirmed = await confirm({
      title: "Mulai Koreksi Essay dengan AI?",
      message: "Model Gemini 3.6 Flash akan mengevaluasi seluruh jawaban uraian siswa secara serentak berdasarkan rubrik dan contoh jawaban ideal.",
      confirmText: "Mulai Koreksi Sekarang",
      cancelText: "Batal",
    });
    if (!confirmed) return;

    setBatchGrading(true);
    try {
      const savedKey = typeof window !== "undefined" ? localStorage.getItem("velonet_gemini_api_key") || "" : "";
      const res = await fetch(`/api/admin/exams/${quizId}/grade-essay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_ai_grade",
          apiKey: savedKey,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        fetchGradingData();
      } else {
        toast.error(json.error || "Gagal menjalankan koreksi AI.");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan koneksi saat koreksi batch.");
    } finally {
      setBatchGrading(false);
    }
  };

  // Batch Approve All AI Scores
  const handleBatchApproveAll = async () => {
    const confirmed = await confirm({
      title: "Setujui Semua Nilai Rekomendasi AI?",
      message: "Seluruh nilai rekomendasi AI akan disimpan sebagai nilai resmi guru dan status ujian siswa akan ditandai selesai dinilai.",
      confirmText: "Ya, Setujui Semua",
      cancelText: "Batal",
    });
    if (!confirmed) return;

    setBatchApproving(true);
    try {
      const res = await fetch(`/api/admin/exams/${quizId}/grade-essay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_approve_all" }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        fetchGradingData();
      } else {
        toast.error(json.error || "Gagal menyetujui nilai AI.");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan saat menyetujui nilai.");
    } finally {
      setBatchApproving(false);
    }
  };

  // Open Remedial Analysis
  const handleOpenRemedialAnalysis = async () => {
    setShowRemedialModal(true);
    setLoadingRemedial(true);
    try {
      const res = await fetch(`/api/admin/exams/${quizId}/remedial-analysis`);
      const json = await res.json();
      if (json.success) {
        setRemedialData(json.data);
      } else {
        toast.error(json.error || "Gagal memuat analisis remedial.");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setLoadingRemedial(false);
    }
  };

  // Publish Remedial Quiz to VeloExambro
  const handlePublishRemedial = async () => {
    if (!remedialData?.remedialQuizDraft) return;
    setPublishingRemedial(true);
    try {
      const draft = remedialData.remedialQuizDraft;
      const res = await fetch("/api/admin/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          category: draft.category || "Remedial",
          durationMinutes: draft.durationMinutes || 20,
          maxStrikes: draft.maxStrikes || 3,
          enableFullscreenLock: draft.enableFullscreenLock ?? true,
          enableCameraProctor: false,
          enableTabSwitchDetect: draft.enableTabSwitchDetect ?? true,
          supervisorPin: draft.supervisorPin || "123456",
          questions: draft.questions,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Kuis Remedial berhasil diterbitkan ke VeloExambro!");
        setShowRemedialModal(false);
      } else {
        toast.error(json.error || "Gagal menerbitkan kuis remedial.");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan saat menyimpan kuis remedial.");
    } finally {
      setPublishingRemedial(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Memuat Buku Nilai Uraian...</p>
      </div>
    );
  }

  const attempts = data?.attempts || [];
  const hasAISuggestions = attempts.some((att: any) =>
    att.answers?.some((a: any) => a.aiSuggestedScore !== null && a.aiSuggestedScore !== undefined)
  );

  return (
    <div className="space-y-6 pb-24 text-slate-900">
      {/* Header with AI Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors border border-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 flex items-center gap-1.5 w-fit">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Buku Nilai & Asisten Koreksi AI
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {data?.quizTitle || "Kuis CBT"}
            </h1>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {/* Remedial Analysis Button */}
          <button
            onClick={handleOpenRemedialAnalysis}
            className="py-2.5 px-3.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-2 btn-press transition-colors cursor-pointer"
            title="Analisis kelemahan kuis dan buat draf kuis remedial terarah"
          >
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span>Analisis & Remedial</span>
          </button>

          {/* Batch AI Grading Button */}
          <button
            onClick={handleBatchAIGrading}
            disabled={batchGrading}
            className="py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-xs btn-press transition-all cursor-pointer disabled:opacity-50"
          >
            {batchGrading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300" />
            )}
            <span>{batchGrading ? "Sedang Mengoreksi..." : "Koreksi Semua dengan AI"}</span>
          </button>

          {/* Batch Approve Button */}
          {hasAISuggestions && (
            <button
              onClick={handleBatchApproveAll}
              disabled={batchApproving}
              className="py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-xs btn-press transition-all cursor-pointer disabled:opacity-50"
            >
              {batchApproving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{batchApproving ? "Menyetujui..." : "Setujui Semua Nilai AI"}</span>
            </button>
          )}

          <button
            onClick={fetchGradingData}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 cursor-pointer"
            title="Muat Ulang Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Attempts List */}
      {attempts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
          Belum ada siswa yang mengumpulkan ujian untuk dinilai.
        </div>
      ) : (
        <div className="space-y-6">
          {attempts.map((att: any) => {
            const essayAnswers = att.answers?.filter((a: any) => a.question?.type === "ESSAY") || [];

            return (
              <div
                key={att.id}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4"
              >
                {/* Student Attempt Header */}
                <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                        {att.userName}
                      </h3>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Kelas: {att.studentClass}</span>
                        <span>•</span>
                        <span>
                          Dikumpulkan:{" "}
                          {att.submittedAt
                            ? new Date(att.submittedAt).toLocaleTimeString("id-ID")
                            : "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase">
                        Skor Total
                      </span>
                      <span className="text-lg font-black text-slate-900">
                        {att.score} / {att.totalScore}
                      </span>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        att.isFullyGraded
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                      }`}
                    >
                      {att.isFullyGraded ? "Telah Dinilai" : "Perlu Diperiksa"}
                    </span>
                  </div>
                </div>

                {/* Essay Answers to Grade */}
                <div className="p-5 sm:p-6 space-y-6">
                  {essayAnswers.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">
                      Tidak ada soal uraian pada ujian ini. Nilai dihitung otomatis 100% oleh sistem.
                    </div>
                  ) : (
                    essayAnswers.map((ans: any, qIdx: number) => {
                      const isSaving = savingAnswerId === ans.id;
                      const maxPoints = ans.question?.points || 10;

                      return (
                        <div
                          key={ans.id}
                          className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 text-xs"
                        >
                          {/* Question Text & Rubric */}
                          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/60">
                            <div>
                              <span className="font-bold text-blue-600 block text-xs">
                                Soal Uraian #{qIdx + 1} ({maxPoints} Poin Maksimal)
                              </span>
                              <p className="font-bold text-slate-900 text-sm mt-1 whitespace-pre-line">
                                {ans.question?.text}
                              </p>
                              {ans.question?.gradingRubric && (
                                <p className="text-[10px] text-slate-500 mt-1">
                                  <strong>Rubrik:</strong> {ans.question.gradingRubric}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Student Response */}
                          <div className="space-y-1.5">
                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              <span>Jawaban Siswa:</span>
                            </span>
                            <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 leading-relaxed whitespace-pre-line font-medium text-xs sm:text-sm">
                              {ans.textResponse || (
                                <span className="text-slate-400 italic">
                                  (Siswa tidak mengisi jawaban)
                                </span>
                              )}
                            </div>
                          </div>

                          {/* AI Evaluation Recommendation Box */}
                          {ans.aiSuggestedScore !== null && ans.aiSuggestedScore !== undefined && (
                            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-slate-900 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs">
                                  <Sparkles className="w-4 h-4 text-amber-500" />
                                  <span>Rekomendasi Penilaian AI:</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-blue-700 bg-white px-2.5 py-0.5 rounded-lg border border-blue-200 text-xs">
                                    Saran: {ans.aiSuggestedScore} / {maxPoints} Poin
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveGrade(att.id, ans.id, true)}
                                    disabled={isSaving}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 btn-press transition-colors cursor-pointer disabled:opacity-50"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Setujui Saran AI</span>
                                  </button>
                                </div>
                              </div>

                              {ans.aiEvaluationFeedback && (
                                <p className="text-[11px] text-blue-800 leading-relaxed italic">
                                  "{ans.aiEvaluationFeedback}"
                                </p>
                              )}
                            </div>
                          )}

                          {/* Teacher Grading Inputs & Action */}
                          <div className="pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                            <div className="sm:col-span-3 space-y-1">
                              <label className="text-[11px] font-bold text-slate-700 block">
                                Skor Guru (Maks {maxPoints})
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={maxPoints}
                                step={0.5}
                                value={teacherScores[ans.id] ?? 0}
                                onChange={(e) =>
                                  setTeacherScores({
                                    ...teacherScores,
                                    [ans.id]: Number(e.target.value),
                                  })
                                }
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-hidden"
                              />
                            </div>

                            <div className="sm:col-span-6 space-y-1">
                              <label className="text-[11px] font-bold text-slate-700 block">
                                Feedback / Catatan Guru
                              </label>
                              <input
                                type="text"
                                value={teacherFeedbacks[ans.id] ?? ""}
                                onChange={(e) =>
                                  setTeacherFeedbacks({
                                    ...teacherFeedbacks,
                                    [ans.id]: e.target.value,
                                  })
                                }
                                placeholder="Tulis feedback untuk siswa..."
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-hidden"
                              />
                            </div>

                            <div className="sm:col-span-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveGrade(att.id, ans.id, false)}
                                disabled={isSaving}
                                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                              >
                                {isSaving ? "Menyimpan..." : "Simpan Nilai"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Remedial & Cognitive Analysis Modal */}
      {showRemedialModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 flex items-center justify-center">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">Analisis Kognitif & Kuis Remedial</h3>
                  <p className="text-[11px] text-slate-300">Diagnosis kelemahan kelas & pemulihan kompetensi</p>
                </div>
              </div>
              <button
                onClick={() => setShowRemedialModal(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {loadingRemedial ? (
                <div className="p-12 text-center text-slate-500 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-sm font-semibold">AI sedang menganalisis pola kesalahan siswa & merancang kuis remedial...</p>
                </div>
              ) : remedialData ? (
                <>
                  {/* Summary Metric Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Peserta Ujian</span>
                      <span className="text-xl font-black text-slate-900">{remedialData.totalAttempts}</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Rata-rata Kelas</span>
                      <span className="text-xl font-black text-blue-600">{remedialData.averageScore}</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Soal Gagal (&gt;25%)</span>
                      <span className="text-xl font-black text-rose-600">{remedialData.failedQuestions?.length || 0}</span>
                    </div>
                  </div>

                  {/* AI Cognitive Analysis Summary */}
                  <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 text-indigo-950 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-900">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Diagnosis Kognitif Guru AI:</span>
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-line">
                      {remedialData.analysisSummary}
                    </p>
                  </div>

                  {/* Most Failed Questions */}
                  {remedialData.failedQuestions && remedialData.failedQuestions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-bold text-xs text-slate-700">Soal dengan Tingkat Kesalahan Tertinggi:</h4>
                      <div className="space-y-2">
                        {remedialData.failedQuestions.map((fq: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 font-bold flex items-center justify-center text-[11px] shrink-0">
                                #{fq.questionNumber}
                              </span>
                              <span className="font-medium text-slate-800 truncate">{fq.text}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold shrink-0">
                              {fq.errorRate}% Salah
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remedial Quiz Draft */}
                  {remedialData.remedialQuizDraft && (
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white border border-slate-800 space-y-3">
                      <div>
                        <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[9px] font-bold uppercase tracking-wider">
                          Draf Kuis Remedial Terarah
                        </span>
                        <h4 className="font-bold text-sm text-white mt-1">{remedialData.remedialQuizDraft.title}</h4>
                        <p className="text-[11px] text-slate-300 mt-0.5">{remedialData.remedialQuizDraft.description}</p>
                        <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-2">
                          <span>{remedialData.remedialQuizDraft.questions?.length || 0} Soal Penguatan</span>
                          <span>•</span>
                          <span>{remedialData.remedialQuizDraft.durationMinutes || 20} Menit</span>
                        </div>
                      </div>

                      {/* Question Pills */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {remedialData.remedialQuizDraft.questions?.map((q: any, qIdx: number) => (
                          <span key={qIdx} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 text-[10px] font-medium border border-slate-700">
                            #{qIdx + 1} ({q.type}) • Bloom {q.bloomLevel || "C2"}
                          </span>
                        ))}
                      </div>

                      {/* Publish Button */}
                      <button
                        onClick={handlePublishRemedial}
                        disabled={publishingRemedial}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs btn-press transition-all cursor-pointer disabled:opacity-50 mt-2"
                      >
                        {publishingRemedial ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span>{publishingRemedial ? "Menerbitkan..." : "Terbitkan Kuis Remedial ke VeloExambro"}</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Tidak ada data analisis yang dapat ditampilkan.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
