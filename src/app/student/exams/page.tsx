"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  BrainCircuit,
  Clock,
  KeyRound,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Search,
  BookOpen,
  Trophy,
  Layers,
  Camera,
  Maximize,
  HelpCircle,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import ExamLeaderboardModal from "@/components/exam/ExamLeaderboardModal";

interface ExamItem {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  totalQuestions: number;
  totalPoints: number;
  enableFullscreenLock: boolean;
  enableTabSwitchDetect: boolean;
  enableCameraProctor: boolean;
  maxStrikes: number;
  hasExamToken: boolean;
  showScoreImmediately: boolean;
  scoreReleaseAt: string | null;
  showDiscussion: boolean;
  isScoreVisible?: boolean;
  isDiscussionVisible?: boolean;
  createdAt: string;
  attempt?: {
    id: string;
    status: "IN_PROGRESS" | "LOCKED" | "SUBMITTED" | "GRADED" | "DISQUALIFIED";
    score: number | null;
    totalScore: number;
    isFullyGraded: boolean;
    strikeCount: number;
    startedAt: string;
    submittedAt?: string | null;
  } | null;
}

export default function StudentExamsPage() {
  const { toast } = useDialog();

  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeaderboardQuiz, setSelectedLeaderboardQuiz] = useState<{ id: string; title: string } | null>(null);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/student/exams");
      const json = await res.json();
      if (json.success && json.data) {
        setExams(json.data);
      } else {
        toast.error(json.error || "Gagal memuat modul ujian.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat memuat modul ujian.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const filteredExams = exams.filter((exam) => {
    const matchesSearch =
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exam.description && exam.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    const isDone =
      exam.attempt?.status === "SUBMITTED" ||
      exam.attempt?.status === "GRADED" ||
      exam.attempt?.status === "DISQUALIFIED";

    if (activeTab === "ACTIVE") return !isDone;
    if (activeTab === "COMPLETED") return isDone;
    return true;
  });

  const activeCount = exams.filter(
    (e) => !e.attempt || e.attempt.status === "IN_PROGRESS" || e.attempt.status === "LOCKED"
  ).length;

  const completedCount = exams.filter(
    (e) => e.attempt?.status === "SUBMITTED" || e.attempt?.status === "GRADED"
  ).length;

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
            <span>VeloExambro Safe CBT</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Pusat Ujian CBT Online
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
            Ikuti ujian resmi dengan pengawasan otomatis, deteksi perpindahan tab, dan kunci layar penuh untuk menjamin integritas kejujuran.
          </p>
        </div>

        {/* Refresh Button */}
        <div className="relative z-10 mt-4 flex items-center gap-2">
          <button
            onClick={fetchExams}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 border border-white/10 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 self-start">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "ALL"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Semua ({exams.length})
          </button>
          <button
            onClick={() => setActiveTab("ACTIVE")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "ACTIVE"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Tersedia / Aktif ({activeCount})
          </button>
          <button
            onClick={() => setActiveTab("COMPLETED")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "COMPLETED"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Selesai ({completedCount})
          </button>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari judul ujian..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Exam Cards Grid */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-400 text-xs">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
          <span>Memuat daftar ujian CBT...</span>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-3">
          <BrainCircuit className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">Tidak ada ujian yang sesuai</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? "Coba gunakan kata kunci pencarian lain."
              : "Belum ada modul ujian resmi yang diterbitkan guru saat ini."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredExams.map((exam) => {
            const attempt = exam.attempt;
            const isDisqualified = attempt?.status === "DISQUALIFIED";
            const isCompleted =
              attempt?.status === "SUBMITTED" ||
              attempt?.status === "GRADED" ||
              isDisqualified;
            const isLocked = attempt?.status === "LOCKED";
            const isInProgress = attempt?.status === "IN_PROGRESS";
            const isScoreVisible = exam.isScoreVisible ?? (attempt?.score !== null && attempt?.score !== undefined);

            return (
              <div
                key={exam.id}
                className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-blue-300 transition-all"
              >
                <div className="space-y-3">
                  {/* Top Status Badges */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200">
                      <ShieldCheck className="w-3 h-3 text-blue-600" />
                      <span>ExamBro Safe</span>
                    </span>

                    {/* Attempt Status Badge */}
                    {isDisqualified ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>Didiskualifikasi (Nilai 0)</span>
                      </span>
                    ) : isCompleted ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Selesai Dikerjakan</span>
                      </span>
                    ) : isLocked ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-rose-600" />
                        <span>Terkunci Pelanggaran</span>
                      </span>
                    ) : isInProgress ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                        <span>Sedang Dikerjakan</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        Belum Dikerjakan
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 leading-snug">
                      {exam.title}
                    </h3>
                    {exam.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {exam.description}
                      </p>
                    )}
                  </div>

                  {/* Info Meta Badges */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600 font-medium">
                    <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>{exam.durationMinutes} Menit</span>
                    </span>

                    <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{exam.totalQuestions} Soal</span>
                    </span>

                    <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                      <Trophy className="w-3.5 h-3.5 text-amber-600" />
                      <span>Max {exam.totalPoints} Poin</span>
                    </span>

                    {exam.hasExamToken && (
                      <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2.5 py-1 rounded-xl border border-purple-200 font-bold">
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Wajib Token</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Action / Score Section */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  {isDisqualified ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center font-mono font-black text-xs">
                        0
                      </div>
                      <div className="text-[11px]">
                        <span className="text-rose-500 block font-bold">Didiskualifikasi:</span>
                        <strong className="text-slate-800 font-bold">
                          0 / {exam.totalPoints} Poin
                        </strong>
                      </div>
                    </div>
                  ) : isCompleted && isScoreVisible ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-mono font-black text-xs">
                        {attempt?.score ?? 0}
                      </div>
                      <div className="text-[11px]">
                        <span className="text-slate-400 block">Skor Nilai:</span>
                        <strong className="text-slate-800 font-bold">
                          {attempt?.score ?? 0} / {exam.totalPoints} Poin
                        </strong>
                      </div>
                    </div>
                  ) : isCompleted && !isScoreVisible ? (
                    <div className="text-[11px] text-amber-600 font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Nilai belum diumumkan</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">
                      {exam.totalQuestions} butir soal
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Leaderboard Button for Completed Exams */}
                    {isCompleted && isScoreVisible && (
                      <button
                        type="button"
                        onClick={() => setSelectedLeaderboardQuiz({ id: exam.id, title: exam.title })}
                        className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                        title="Lihat Papan Peringkat"
                      >
                        <Trophy className="w-3.5 h-3.5 text-amber-600" />
                        <span className="hidden sm:inline">Peringkat</span>
                      </button>
                    )}

                    <Link
                      href={`/student/quiz/${exam.id}`}
                      className={`px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all ${
                        isDisqualified
                          ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                          : isCompleted
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-slate-200/50"
                          : isLocked
                          ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25 animate-pulse"
                          : isInProgress
                          ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25"
                          : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25"
                      }`}
                    >
                      <span>
                        {isDisqualified
                          ? "Status Diskualifikasi"
                          : isCompleted
                          ? "Lihat Hasil Ujian"
                          : isLocked
                          ? "Buka Kunci"
                          : isInProgress
                          ? "Lanjutkan Ujian"
                          : "Ikuti Ujian"}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Leaderboard Modal */}
      {selectedLeaderboardQuiz && (
        <ExamLeaderboardModal
          isOpen={Boolean(selectedLeaderboardQuiz)}
          onClose={() => setSelectedLeaderboardQuiz(null)}
          quizId={selectedLeaderboardQuiz.id}
          quizTitle={selectedLeaderboardQuiz.title}
        />
      )}
    </div>
  );
}
