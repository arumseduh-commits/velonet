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

  // Submit Grade (either approve AI score or submit teacher manual score)
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

  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Memuat Buku Nilai Uraian...</p>
      </div>
    );
  }

  const attempts = data?.attempts || [];

  return (
    <div className="space-y-6 pb-24 text-slate-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
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
              Buku Nilai & Koreksi Uraian AI
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {data?.quizTitle || "Kuis CBT"}
            </h1>
          </div>
        </div>

        <button
          onClick={fetchGradingData}
          className="p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors border border-blue-200 cursor-pointer flex items-center gap-2 text-xs font-bold self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Data</span>
        </button>
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
                          {/* Question Text */}
                          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/60">
                            <div>
                              <span className="font-bold text-blue-600 block text-xs">
                                Soal Uraian #{qIdx + 1} ({maxPoints} Poin Maksimal)
                              </span>
                              <p className="font-bold text-slate-900 text-sm mt-1 whitespace-pre-line">
                                {ans.question?.text}
                              </p>
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
                          {ans.aiEvaluationFeedback && (
                            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-slate-900 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs">
                                  <Sparkles className="w-4 h-4 text-amber-500" />
                                  <span>Rekomendasi Penilaian AI:</span>
                                </div>
                                <span className="font-mono font-bold text-blue-700 bg-white px-2.5 py-0.5 rounded-lg border border-blue-200 text-xs">
                                  Saran: {ans.aiSuggestedScore} / {maxPoints} Poin
                                </span>
                              </div>

                              <p className="text-[11px] text-blue-800 leading-relaxed">
                                {ans.aiEvaluationFeedback}
                              </p>
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
                              {ans.aiSuggestedScore !== undefined && (
                                <button
                                  type="button"
                                  onClick={() => handleSaveGrade(att.id, ans.id, true)}
                                  disabled={isSaving}
                                  className="flex-1 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50"
                                  title="Gunakan nilai dan feedback dari rekomendasi AI"
                                >
                                  <span>Setujui AI</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleSaveGrade(att.id, ans.id, false)}
                                disabled={isSaving}
                                className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                              >
                                {isSaving ? "Menyimpan..." : "Simpan Skor"}
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
    </div>
  );
}
