"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Users,
  AlertTriangle,
  Clock,
  KeyRound,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Send,
  UserX,
  RotateCcw,
  Trophy,
  Crown,
  Flame,
  Zap,
  Play,
  Pause,
  Maximize,
  Minimize,
  Sparkles,
  Layers,
  ArrowUp,
  ArrowDown,
  Minus,
  Medal,
  Activity,
  Check,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface QuestionMeta {
  id: string;
  text: string;
  points: number;
  order: number;
  type: string;
}

interface ParticipantRecord {
  id: string;
  studentId: string;
  userId: string;
  studentName: string;
  userName: string;
  phoneNumber: string;
  studentClass: string;
  status: "IN_PROGRESS" | "LOCKED" | "SUBMITTED" | "GRADED" | "DISQUALIFIED";
  strikes: number;
  strikeCount: number;
  score: number;
  totalScore: number;
  answeredCount: number;
  totalQuestions: number;
  progressPercentage: number;
  answeredQuestionIds: string[];
  startedAt: string;
  submittedAt?: string | null;
  updatedAt: string;
  lastPing: string;
  violations?: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
}

interface RankShiftInfo {
  delta: number;
  type: "UP" | "DOWN" | "SAME";
}

export default function ExamProctorControlRoom() {
  const router = useRouter();
  const params = useParams();
  const quizId = params.quizId as string;
  const { confirm, toast } = useDialog();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"SCORE" | "PROGRESS" | "STRIKES" | "NAME">("SCORE");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Concurrency lock to prevent duplicate overlapping network requests
  const isFetchingRef = useRef(false);

  // Dynamic Rank Shift Tracking across polling cycles
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const [rankDeltas, setRankDeltas] = useState<{ [attemptId: string]: RankShiftInfo }>({});

  const fetchProctorData = useCallback(
    async (isManual = false) => {
      if (isFetchingRef.current && !isManual) return;
      isFetchingRef.current = true;
      if (isManual) setRefreshing(true);

      try {
        const res = await fetch(`/api/admin/exams/${quizId}/proctor`);
        const json = await res.json();

        if (json.success && json.data) {
          const fetchedParticipants: ParticipantRecord[] =
            json.data.participants || json.data.attempts || [];

          // Compute dynamic rank shifts based on leaderboard ordering (by score desc)
          const sortedByLeaderboard = [...fetchedParticipants].sort((a, b) => {
            if (a.status === "DISQUALIFIED" && b.status !== "DISQUALIFIED") return 1;
            if (b.status === "DISQUALIFIED" && a.status !== "DISQUALIFIED") return -1;
            if (b.score !== a.score) return b.score - a.score;
            if (b.answeredCount !== a.answeredCount) return b.answeredCount - a.answeredCount;
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          });

          const newDeltas: { [attemptId: string]: RankShiftInfo } = {};

          sortedByLeaderboard.forEach((p, idx) => {
            const currentRank = idx + 1;
            const prevRank = prevRanksRef.current.get(p.id);

            if (prevRank !== undefined) {
              if (currentRank < prevRank) {
                newDeltas[p.id] = { delta: prevRank - currentRank, type: "UP" };
              } else if (currentRank > prevRank) {
                newDeltas[p.id] = { delta: currentRank - prevRank, type: "DOWN" };
              } else {
                newDeltas[p.id] = { delta: 0, type: "SAME" };
              }
            } else {
              newDeltas[p.id] = { delta: 0, type: "SAME" };
            }

            prevRanksRef.current.set(p.id, currentRank);
          });

          setRankDeltas(newDeltas);
          setData(json.data);
        } else {
          if (isManual) toast.error(json.error || "Gagal memuat data pengawas.");
        }
      } catch (err) {
        if (isManual) toast.error("Terjadi kesalahan jaringan.");
      } finally {
        setLoading(false);
        if (isManual) setRefreshing(false);
        isFetchingRef.current = false;
      }
    },
    [quizId, toast]
  );

  // 3s Realtime Polling with concurrency guard
  useEffect(() => {
    fetchProctorData();
    if (!isLiveActive) return;

    const interval = setInterval(() => {
      fetchProctorData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchProctorData, isLiveActive]);

  // Supervisor Action Handlers (All wired with custom useDialog)
  const handleAction = async (
    attemptId: string,
    studentName: string,
    action: "UNLOCK" | "RESET_STRIKES" | "FORCE_SUBMIT" | "DISQUALIFY"
  ) => {
    let confirmTitle = "";
    let confirmMsg = "";
    let confirmVariant: "info" | "warning" | "danger" = "info";
    let confirmIcon: "shield" | "trash" | "send" | "warning" = "info" as any;

    if (action === "UNLOCK") {
      confirmTitle = "Buka Kunci Ujian Siswa";
      confirmMsg = `Buka kembali ujian untuk ${studentName}? Status ujian akan diaktifkan kembali dan siswa dapat melanjutkan pengerjaan.`;
      confirmVariant = "info";
      confirmIcon = "shield";
    } else if (action === "RESET_STRIKES") {
      confirmTitle = "Setel Ulang Pelanggaran";
      confirmMsg = `Reset jumlah poin pelanggaran untuk ${studentName} menjadi 0 Strike?`;
      confirmVariant = "warning";
      confirmIcon = "shield";
    } else if (action === "FORCE_SUBMIT") {
      confirmTitle = "Kumpulkan Paksa Ujian";
      confirmMsg = `Kumpulkan paksa ujian untuk ${studentName} sekarang? Seluruh jawaban yang telah dijawab akan langsung dinilai.`;
      confirmVariant = "warning";
      confirmIcon = "send";
    } else if (action === "DISQUALIFY") {
      confirmTitle = "Diskualifikasi Peserta";
      confirmMsg = `Apakah Anda yakin ingin mendiskualifikasi ${studentName}? Siswa akan dikeluarkan dari ruang ujian dan nilai akhir disetel ke 0.`;
      confirmVariant = "danger";
      confirmIcon = "trash";
    }

    const ok = await confirm({
      title: confirmTitle,
      message: confirmMsg,
      variant: confirmVariant,
      icon: confirmIcon,
      confirmText: "Ya, Lanjutkan",
      cancelText: "Batal",
    });

    if (!ok) return;

    setActionLoadingId(attemptId);
    try {
      const res = await fetch(`/api/admin/exams/${quizId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, action }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Aksi berhasil diterapkan.");
        fetchProctorData(false);
      } else {
        toast.error(json.error || "Gagal menerapkan aksi.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan server saat menerapkan aksi.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const quiz = data?.quiz;
  const quizQuestions: QuestionMeta[] = quiz?.questions || [];
  const stats = data?.stats || {
    totalParticipants: 0,
    inProgress: 0,
    locked: 0,
    submitted: 0,
    disqualified: 0,
  };
  const rawParticipants: ParticipantRecord[] = data?.participants || data?.attempts || [];

  // Distinct Classes for Filter Dropdown
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    rawParticipants.forEach((a) => {
      if (a.studentClass && a.studentClass !== "-") set.add(a.studentClass);
    });
    return Array.from(set).sort();
  }, [rawParticipants]);

  // Leaderboard Sorted Attempts for Top 3 Podium
  const leaderboardParticipants = useMemo(() => {
    return [...rawParticipants].sort((a, b) => {
      if (a.status === "DISQUALIFIED" && b.status !== "DISQUALIFIED") return 1;
      if (b.status === "DISQUALIFIED" && a.status !== "DISQUALIFIED") return -1;
      if (b.score !== a.score) return b.score - a.score;
      if (b.answeredCount !== a.answeredCount) return b.answeredCount - a.answeredCount;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [rawParticipants]);

  // Top 3 Podium Leaders (1: Gold, 2: Silver, 3: Bronze)
  const top3 = useMemo(() => {
    const activeValid = leaderboardParticipants.filter((a) => a.status !== "DISQUALIFIED");
    return [activeValid[0] || null, activeValid[1] || null, activeValid[2] || null];
  }, [leaderboardParticipants]);

  // Filtered and Sorted Participants for the List
  const processedParticipants = useMemo(() => {
    return rawParticipants
      .filter((att) => {
        const name = att.studentName || att.userName || "";
        const matchesSearch =
          name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          att.phoneNumber.includes(searchQuery) ||
          att.studentClass.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;
        if (selectedClass !== "ALL" && att.studentClass !== selectedClass) return false;
        if (statusFilter !== "ALL") {
          if (statusFilter === "SUBMITTED") {
            if (att.status !== "SUBMITTED" && att.status !== "GRADED") return false;
          } else if (att.status !== statusFilter) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "STRIKES") {
          return (b.strikes || b.strikeCount) - (a.strikes || a.strikeCount);
        }
        if (sortBy === "PROGRESS") {
          return b.progressPercentage - a.progressPercentage;
        }
        if (sortBy === "NAME") {
          const nameA = a.studentName || a.userName || "";
          const nameB = b.studentName || b.userName || "";
          return nameA.localeCompare(nameB);
        }
        // Default: By Score (Leaderboard)
        if (a.status === "DISQUALIFIED" && b.status !== "DISQUALIFIED") return 1;
        if (b.status === "DISQUALIFIED" && a.status !== "DISQUALIFIED") return -1;
        if (b.score !== a.score) return b.score - a.score;
        if (b.answeredCount !== a.answeredCount) return b.answeredCount - a.answeredCount;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [rawParticipants, searchQuery, selectedClass, statusFilter, sortBy]);

  // Helper for rank delta badge
  const renderRankDeltaBadge = (attemptId: string) => {
    const shift = rankDeltas[attemptId];
    if (!shift) return null;

    if (shift.type === "UP" && shift.delta > 0) {
      return (
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black animate-bounce"
          title={`Peringkat naik +${shift.delta}`}
        >
          <ArrowUp className="w-2.5 h-2.5" />
          <span>{shift.delta}</span>
        </span>
      );
    }
    if (shift.type === "DOWN" && shift.delta > 0) {
      return (
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-400/40 text-[10px] font-black"
          title={`Peringkat turun -${shift.delta}`}
        >
          <ArrowDown className="w-2.5 h-2.5" />
          <span>{shift.delta}</span>
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold"
        title="Peringkat stabil"
      >
        <Minus className="w-2.5 h-2.5" />
      </span>
    );
  };

  if (loading && !data) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center text-slate-500 space-y-3">
        <RefreshCw className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-sm font-bold text-slate-700">Menghubungkan ke Live Proctoring Room...</p>
        <span className="text-xs text-slate-400">Sinkronisasi data real-time peserta</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 pb-24 ${isFullscreenMode ? "p-4 sm:p-6 bg-slate-950 text-white min-h-screen" : ""}`}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/40">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {!isFullscreenMode && (
            <button
              onClick={() => router.back()}
              className="p-2.5 sm:p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10 cursor-pointer shrink-0 min-h-[40px] flex items-center justify-center"
              title="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2.5 sm:px-3 py-1 rounded-full border border-emerald-400/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Quizizz Live Stream • 3s Polling</span>
              </span>

              {quiz?.durationMinutes && (
                <span className="text-[10px] sm:text-[11px] text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span>{quiz.durationMinutes} Menit</span>
                </span>
              )}
            </div>

            <h1 className="text-lg sm:text-2xl font-black text-white mt-1.5 flex items-center gap-2 truncate">
              <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 shrink-0" />
              <span className="truncate">{quiz?.title || "Live Proctoring Room"}</span>
            </h1>
          </div>
        </div>

        {/* Right Tools: PIN, Live Toggle & Projector Mode */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          {/* Supervisor PIN */}
          <div className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-sm min-h-[40px]">
            <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="text-xs">
              <span className="text-slate-400 block text-[9px] uppercase font-bold">PIN Pengawas</span>
              <span className="font-mono font-black tracking-widest text-amber-300 text-xs sm:text-sm">
                {quiz?.supervisorPin || "123456"}
              </span>
            </div>
          </div>

          {/* Pause / Play Live Polling */}
          <button
            type="button"
            onClick={() => setIsLiveActive((prev) => !prev)}
            className={`px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer min-h-[40px] ${
              isLiveActive
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/30"
                : "bg-amber-500/20 text-amber-300 border-amber-400/30 hover:bg-amber-500/30"
            }`}
          >
            {isLiveActive ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Live On</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Jeda Live</span>
              </>
            )}
          </button>

          {/* Refresh Manual */}
          <button
            type="button"
            onClick={() => fetchProctorData(true)}
            disabled={refreshing}
            className="p-2.5 sm:p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10 cursor-pointer min-h-[40px] flex items-center justify-center"
            title="Muat Ulang Data Sekarang"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          {/* Fullscreen Projector Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreenMode((prev) => !prev)}
            className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer border border-indigo-400/30 min-h-[40px]"
            title="Tampilkan Mode Proyektor Layar Penuh"
          >
            {isFullscreenMode ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreenMode ? "Keluar Layar Penuh" : "Mode Proyektor"}</span>
          </button>
        </div>
      </div>

      {/* Gamified Live Podium Top 3 (Quizizz Style: 2 - 1 - 3) */}
      <div className="p-5 sm:p-8 rounded-3xl bg-gradient-to-b from-indigo-950/90 via-slate-900/95 to-slate-900 text-white border border-indigo-800/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Trophy className="w-64 h-64 text-amber-400" />
        </div>

        <div className="flex items-center justify-between gap-2 mb-6 flex-wrap relative z-10">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 className="text-sm sm:text-lg font-black tracking-tight">
              Papan Peringkat Sementara (Live Top 3 Podium)
            </h2>
          </div>
          <span className="text-xs text-indigo-300 font-semibold flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Skor poin diperbarui real-time ala Quizizz</span>
          </span>
        </div>

        {/* Podium Pillars (Left: #2 Silver, Center: #1 Gold, Right: #3 Bronze) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-6 items-end max-w-2xl mx-auto pt-4 relative z-10">
          {/* Rank 2 (Silver) - Medium Height */}
          <div className="flex flex-col items-center">
            {top3[1] ? (
              <div className="text-center space-y-1 sm:space-y-1.5 mb-2 w-full px-1">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {renderRankDeltaBadge(top3[1].id)}
                </div>
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-slate-400 to-slate-200 text-slate-950 font-black text-xs sm:text-base flex items-center justify-center mx-auto shadow-lg border-2 border-slate-300 ring-2 ring-slate-400/40">
                  {(top3[1].studentName || top3[1].userName || "S").charAt(0).toUpperCase()}
                </div>
                <div className="font-extrabold text-[11px] sm:text-sm text-slate-100 truncate">
                  {top3[1].studentName || top3[1].userName}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 truncate">
                  {top3[1].studentClass || "Tanpa Kelas"}
                </div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-200 text-[10px] font-black">
                  <Zap className="w-2.5 h-2.5 text-slate-300" />
                  <span>{top3[1].score} pts</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 mb-2">Menunggu...</div>
            )}
            <div className="w-full h-28 sm:h-36 rounded-t-2xl bg-gradient-to-t from-slate-800 to-slate-700/90 border-t-2 border-slate-400 flex flex-col items-center justify-center text-slate-300 shadow-inner">
              <span className="text-2xl sm:text-3xl font-black">2</span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Perak</span>
            </div>
          </div>

          {/* Rank 1 (Gold) - Tallest Height Center */}
          <div className="flex flex-col items-center">
            {top3[0] ? (
              <div className="text-center space-y-1 sm:space-y-1.5 mb-2 w-full px-1">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {renderRankDeltaBadge(top3[0].id)}
                </div>
                <div className="relative inline-block">
                  <Crown className="w-6 h-6 text-amber-400 absolute -top-4 left-1/2 -translate-x-1/2 animate-bounce" />
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-amber-950 font-black text-sm sm:text-lg flex items-center justify-center mx-auto shadow-xl border-2 border-amber-200 ring-4 ring-amber-400/40">
                    {(top3[0].studentName || top3[0].userName || "G").charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="font-black text-xs sm:text-base text-amber-200 truncate">
                  {top3[0].studentName || top3[0].userName}
                </div>
                <div className="text-[9px] sm:text-[10px] text-amber-300/80 truncate">
                  {top3[0].studentClass || "Tanpa Kelas"}
                </div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/60 text-amber-300 text-[11px] font-black shadow-xs">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>{top3[0].score} pts</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-500 mb-2">Menunggu...</div>
            )}
            <div className="w-full h-36 sm:h-48 rounded-t-2xl bg-gradient-to-t from-amber-950/90 to-amber-700/90 border-t-2 border-amber-300 flex flex-col items-center justify-center text-amber-200 shadow-xl ring-2 ring-amber-500/30">
              <span className="text-3xl sm:text-4xl font-black">1</span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-300">Emas</span>
            </div>
          </div>

          {/* Rank 3 (Bronze) - Lower Height Right */}
          <div className="flex flex-col items-center">
            {top3[2] ? (
              <div className="text-center space-y-1 sm:space-y-1.5 mb-2 w-full px-1">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {renderRankDeltaBadge(top3[2].id)}
                </div>
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-800 to-amber-600 text-amber-100 font-black text-xs sm:text-base flex items-center justify-center mx-auto shadow-lg border-2 border-amber-700 ring-2 ring-amber-700/40">
                  {(top3[2].studentName || top3[2].userName || "B").charAt(0).toUpperCase()}
                </div>
                <div className="font-extrabold text-[11px] sm:text-sm text-slate-200 truncate">
                  {top3[2].studentName || top3[2].userName}
                </div>
                <div className="text-[9px] sm:text-[10px] text-slate-400 truncate">
                  {top3[2].studentClass || "Tanpa Kelas"}
                </div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-400 text-[10px] font-black">
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  <span>{top3[2].score} pts</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 mb-2">Menunggu...</div>
            )}
            <div className="w-full h-24 sm:h-30 rounded-t-2xl bg-gradient-to-t from-slate-900 to-amber-950/70 border-t-2 border-amber-700 flex flex-col items-center justify-center text-amber-400 shadow-inner">
              <span className="text-2xl sm:text-3xl font-black">3</span>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-amber-600">Perunggu</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase">Total Peserta</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{stats.totalParticipants}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase">Mengerjakan</span>
            <Clock className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">{stats.inProgress}</div>
        </div>

        <div
          className={`p-4 rounded-2xl border shadow-xs transition-all ${
            stats.locked > 0
              ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400/30 animate-pulse"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className={`text-xs font-bold uppercase ${stats.locked > 0 ? "text-rose-700 font-extrabold" : ""}`}>
              Terkunci (Perlu Aksi)
            </span>
            <Lock className={`w-4 h-4 ${stats.locked > 0 ? "text-rose-600" : "text-slate-400"}`} />
          </div>
          <div className={`text-2xl font-black mt-2 ${stats.locked > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {stats.locked}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase">Selesai</span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 mt-2">{stats.submitted}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase">Diskualifikasi</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-600 mt-2">{stats.disqualified}</div>
        </div>
      </div>

      {/* Filter, Sort & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { key: "ALL", label: `Semua (${rawParticipants.length})` },
            { key: "IN_PROGRESS", label: `Mengerjakan (${stats.inProgress})` },
            { key: "LOCKED", label: `Terkunci (${stats.locked})` },
            { key: "SUBMITTED", label: `Selesai (${stats.submitted})` },
            { key: "DISQUALIFIED", label: `Diskualifikasi (${stats.disqualified})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer min-h-[36px] ${
                statusFilter === tab.key
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Class Filter, Sort & Search */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {availableClasses.length > 0 && (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
            >
              <option value="ALL">Semua Kelas</option>
              {availableClasses.map((c) => (
                <option key={c} value={c}>
                  Kelas {c}
                </option>
              ))}
            </select>
          )}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
          >
            <option value="SCORE">Urut: Skor Tertinggi 🏆</option>
            <option value="PROGRESS">Urut: Progress Tercepat 📑</option>
            <option value="STRIKES">Urut: Pelanggaran Terbanyak ⚠️</option>
            <option value="NAME">Urut: Nama Siswa (A-Z) 🔤</option>
          </select>

          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama / NIS..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 min-h-[40px]"
            />
          </div>
        </div>
      </div>

      {/* Realtime Live Proctor Leaderboard List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Peserta Ujian CBT ({processedParticipants.length})</span>
          </h3>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Live Sync Aktif (3 Detik)</span>
          </div>
        </div>

        {processedParticipants.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Tidak ada peserta yang cocok dengan kriteria filter saat ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {processedParticipants.map((att, idx) => {
              const isLocked = att.status === "LOCKED";
              const isDisqualified = att.status === "DISQUALIFIED";
              const isSubmitted = att.status === "SUBMITTED" || att.status === "GRADED";
              const isInProgress = att.status === "IN_PROGRESS";
              const isProcessing = actionLoadingId === att.id;
              const studentDisplayName = att.studentName || att.userName || "Peserta";
              const strikeCount = att.strikes !== undefined ? att.strikes : att.strikeCount || 0;
              const maxStrikes = quiz?.maxStrikes || 3;
              const answeredIds = att.answeredQuestionIds || [];

              return (
                <div
                  key={att.id}
                  className={`p-4 sm:p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 transition-colors ${
                    isLocked
                      ? "bg-rose-50/70 hover:bg-rose-50"
                      : isDisqualified
                      ? "bg-slate-50/80 opacity-70"
                      : "hover:bg-slate-50/80"
                  }`}
                >
                  {/* Left: Rank & User Profile */}
                  <div className="flex items-center gap-3 min-w-[240px]">
                    {/* Rank Badge + Delta Shift */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shadow-xs ${
                          idx === 0
                            ? "bg-amber-400 text-amber-950 ring-2 ring-amber-300"
                            : idx === 1
                            ? "bg-slate-300 text-slate-900"
                            : idx === 2
                            ? "bg-amber-700 text-amber-100"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      {renderRankDeltaBadge(att.id)}
                    </div>

                    {/* Avatar Initials + Student Info */}
                    <div className="space-y-1 min-w-0">
                      <div className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                        <span className="truncate">{studentDisplayName}</span>

                        {/* Status Badges */}
                        {isInProgress && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold border border-blue-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
                            <span>Mengerjakan</span>
                          </span>
                        )}
                        {isLocked && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-200 animate-pulse flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>Terkunci</span>
                          </span>
                        )}
                        {isSubmitted && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Selesai</span>
                          </span>
                        )}
                        {isDisqualified && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-extrabold border border-slate-300 flex items-center gap-1">
                            <UserX className="w-3 h-3" />
                            <span>Didiskualifikasi</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">{att.studentClass || "Tanpa Kelas"}</span>
                        <span>•</span>
                        <span>{att.phoneNumber || "-"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Progress Bar, Per-Question Visual Dots & Realtime Score */}
                  <div className="flex-1 max-w-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium flex items-center gap-1 text-[11px]">
                        <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>
                          {att.answeredCount} / {att.totalQuestions} Soal ({att.progressPercentage}%)
                        </span>
                      </span>

                      {/* Realtime Score Pill */}
                      <span
                        className={`font-mono font-black text-xs px-2.5 py-0.5 rounded-lg border flex items-center gap-1 ${
                          isDisqualified
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs"
                        }`}
                      >
                        <Zap className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>
                          {att.score} / {att.totalScore} Poin
                        </span>
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isDisqualified
                            ? "bg-rose-500"
                            : isSubmitted
                            ? "bg-blue-600"
                            : "bg-gradient-to-r from-emerald-500 to-indigo-600"
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, att.progressPercentage))}%` }}
                      />
                    </div>

                    {/* Per-Question Visual Dot Matrix */}
                    {quizQuestions.length > 0 && (
                      <div className="flex items-center gap-1 overflow-x-auto py-1 max-w-full">
                        {quizQuestions.map((q, qIdx) => {
                          const isAnswered = answeredIds.includes(q.id);
                          return (
                            <div
                              key={q.id}
                              title={`Soal #${qIdx + 1}: ${isAnswered ? "Terjawab" : "Belum Dijawab"}`}
                              className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ${
                                isAnswered
                                  ? "bg-emerald-500 shadow-xs shadow-emerald-500/50"
                                  : "bg-slate-200 border border-slate-300"
                              }`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right: Strike Indicator & Quick Supervisor Action Buttons */}
                  <div className="flex items-center justify-between lg:justify-end gap-2.5 shrink-0 flex-wrap">
                    {/* Strike Indicator */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono font-bold text-[11px] px-2.5 py-1.5 rounded-xl border flex items-center gap-1 ${
                          strikeCount >= maxStrikes
                            ? "bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse"
                            : strikeCount > 0
                            ? "bg-amber-100 text-amber-800 border-amber-300 font-bold"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                        title="Jumlah Peringatan Pelanggaran Siswa"
                      >
                        <AlertTriangle
                          className={`w-3.5 h-3.5 ${
                            strikeCount >= maxStrikes
                              ? "text-rose-600"
                              : strikeCount > 0
                              ? "text-amber-600"
                              : "text-slate-400"
                          }`}
                        />
                        <span>
                          {strikeCount} / {maxStrikes} Strike
                        </span>
                      </span>
                    </div>

                    {/* Quick Supervisor Actions */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isLocked && (
                        <button
                          type="button"
                          onClick={() => handleAction(att.id, studentDisplayName, "UNLOCK")}
                          disabled={isProcessing}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer min-h-[40px]"
                          title="Buka Kunci Ujian Siswa"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Buka Kunci</span>
                        </button>
                      )}

                      {isInProgress && (
                        <>
                          {strikeCount > 0 && (
                            <button
                              type="button"
                              onClick={() => handleAction(att.id, studentDisplayName, "RESET_STRIKES")}
                              disabled={isProcessing}
                              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer min-h-[40px] flex items-center justify-center"
                              title="Reset Pelanggaran Siswa ke 0"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleAction(att.id, studentDisplayName, "FORCE_SUBMIT")}
                            disabled={isProcessing}
                            className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs min-h-[40px]"
                            title="Kumpulkan Paksa Ujian Siswa"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Kumpulkan</span>
                          </button>
                        </>
                      )}

                      {!isDisqualified && (
                        <button
                          type="button"
                          onClick={() => handleAction(att.id, studentDisplayName, "DISQUALIFY")}
                          disabled={isProcessing}
                          className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer min-h-[40px] flex items-center justify-center border border-rose-200"
                          title="Diskualifikasi Siswa (Nilai 0)"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

