"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface AttemptRecord {
  id: string;
  userId: string;
  userName: string;
  phoneNumber: string;
  studentClass: string;
  status: "IN_PROGRESS" | "LOCKED" | "SUBMITTED" | "GRADED" | "DISQUALIFIED";
  strikeCount: number;
  score: number;
  totalScore: number;
  answeredCount: number;
  totalQuestions: number;
  progressPercentage: number;
  startedAt: string;
  submittedAt?: string | null;
  updatedAt: string;
  violations?: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
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
  const [sortBy, setSortBy] = useState<"SCORE" | "PROGRESS" | "STRIKES">("SCORE");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchProctorData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/exams/${quizId}/proctor`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        if (isManual) toast.error(json.error || "Gagal memuat data pengawas.");
      }
    } catch (err) {
      if (isManual) toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [quizId, toast]);

  // Real-time polling every 3 seconds when live mode is active
  useEffect(() => {
    fetchProctorData();
    if (!isLiveActive) return;

    const interval = setInterval(() => {
      fetchProctorData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchProctorData, isLiveActive]);

  // Supervisor Action Handlers
  const handleAction = async (
    attemptId: string,
    studentName: string,
    action: "UNLOCK" | "RESET_STRIKES" | "FORCE_SUBMIT" | "DISQUALIFY"
  ) => {
    let confirmTitle = "";
    let confirmMsg = "";
    let confirmVariant: "info" | "warning" | "danger" = "info";

    if (action === "UNLOCK") {
      confirmTitle = "Buka Kunci Ujian Siswa";
      confirmMsg = `Buka kembali ujian untuk ${studentName}? Pelanggaran akan disetel ulang agar siswa bisa melanjutkan ujian.`;
      confirmVariant = "info";
    } else if (action === "RESET_STRIKES") {
      confirmTitle = "Setel Ulang Pelanggaran";
      confirmMsg = `Reset poin pelanggaran ${studentName} menjadi 0?`;
      confirmVariant = "warning";
    } else if (action === "FORCE_SUBMIT") {
      confirmTitle = "Kumpulkan Paksa Ujian";
      confirmMsg = `Kumpulkan paksa ujian untuk ${studentName} sekarang? Jawaban yang telah dijawab akan langsung dinilai.`;
      confirmVariant = "warning";
    } else if (action === "DISQUALIFY") {
      confirmTitle = "Diskualifikasi Peserta";
      confirmMsg = `Apakah Anda yakin ingin mendiskualifikasi ${studentName}? Nilai ujian akan menjadi 0.`;
      confirmVariant = "danger";
    }

    const ok = await confirm({
      title: confirmTitle,
      message: confirmMsg,
      variant: confirmVariant,
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
      toast.error("Terjadi kesalahan server.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const quiz = data?.quiz;
  const stats = data?.stats || {
    totalParticipants: 0,
    inProgress: 0,
    locked: 0,
    submitted: 0,
    disqualified: 0,
  };
  const rawAttempts: AttemptRecord[] = data?.attempts || [];

  // Get distinct classes for filter
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    rawAttempts.forEach((a) => {
      if (a.studentClass && a.studentClass !== "-") set.add(a.studentClass);
    });
    return Array.from(set).sort();
  }, [rawAttempts]);

  // Filtered and Sorted Attempts
  const processedAttempts = useMemo(() => {
    return rawAttempts
      .filter((att) => {
        const matchesSearch =
          att.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          att.phoneNumber.includes(searchQuery) ||
          att.studentClass.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;
        if (selectedClass !== "ALL" && att.studentClass !== selectedClass) return false;
        if (statusFilter !== "ALL" && att.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "STRIKES") {
          return b.strikeCount - a.strikeCount;
        }
        if (sortBy === "PROGRESS") {
          return b.progressPercentage - a.progressPercentage;
        }
        // Default: By Score
        if (a.status === "DISQUALIFIED" && b.status !== "DISQUALIFIED") return 1;
        if (b.status === "DISQUALIFIED" && a.status !== "DISQUALIFIED") return -1;
        if (b.score !== a.score) return b.score - a.score;
        if (b.progressPercentage !== a.progressPercentage) return b.progressPercentage - a.progressPercentage;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [rawAttempts, searchQuery, selectedClass, statusFilter, sortBy]);

  // Top 3 Podium Leaders
  const top3 = useMemo(() => {
    const activeValid = rawAttempts.filter((a) => a.status !== "DISQUALIFIED");
    return [activeValid[0] || null, activeValid[1] || null, activeValid[2] || null];
  }, [rawAttempts]);

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
    <div className={`space-y-6 pb-24 ${isFullscreenMode ? "p-6 bg-slate-950 text-white min-h-screen" : ""}`}>
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-900/40">
        <div className="flex items-center gap-4">
          {!isFullscreenMode && (
            <button
              onClick={() => router.back()}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-400/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Quizizz Live Stream • Realtime</span>
              </span>

              {quiz?.durationMinutes && (
                <span className="text-[11px] text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span>{quiz.durationMinutes} Menit</span>
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white mt-1.5 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-indigo-400" />
              <span>{quiz?.title || "Live Proctoring Room"}</span>
            </h1>
          </div>
        </div>

        {/* Right Tools: PIN, Live Toggle & Projector Mode */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Supervisor PIN */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 shadow-sm">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <div className="text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">PIN Pengawas</span>
              <span className="font-mono font-black tracking-widest text-amber-300 text-sm">
                {quiz?.supervisorPin || "123456"}
              </span>
            </div>
          </div>

          {/* Pause / Play Live Polling */}
          <button
            type="button"
            onClick={() => setIsLiveActive((prev) => !prev)}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
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
            className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10 cursor-pointer"
            title="Muat Ulang Data Sekarang"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          {/* Fullscreen Projector Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreenMode((prev) => !prev)}
            className="px-3.5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer border border-indigo-400/30"
            title="Tampilkan Mode Proyektor Layar Penuh"
          >
            {isFullscreenMode ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreenMode ? "Keluar Layar Penuh" : "Mode Proyektor"}</span>
          </button>
        </div>
      </div>

      {/* Gamified Live Podium Top 3 (Quizizz Style) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-indigo-950/80 via-slate-900/90 to-slate-900 text-white border border-indigo-800/40 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Trophy className="w-64 h-64 text-amber-400" />
        </div>

        <div className="flex items-center justify-between gap-2 mb-6 flex-wrap relative z-10">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-black tracking-tight">
              Papan Peringkat Sementara (Live Podium)
            </h2>
          </div>
          <span className="text-xs text-indigo-300 font-semibold flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Skor diperbarui real-time tiap butir jawaban</span>
          </span>
        </div>

        {/* Podium Pillars */}
        <div className="grid grid-cols-3 gap-2 sm:gap-6 items-end max-w-2xl mx-auto pt-4 relative z-10">
          {/* Rank 2 (Silver) */}
          <div className="flex flex-col items-center">
            {top3[1] ? (
              <div className="text-center space-y-1.5 mb-2 w-full px-1">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-slate-400 to-slate-200 text-slate-950 font-black text-xs sm:text-base flex items-center justify-center mx-auto shadow-lg border-2 border-slate-300 ring-2 ring-slate-400/40">
                  {top3[1].userName.charAt(0).toUpperCase()}
                </div>
                <div className="font-extrabold text-xs sm:text-sm text-slate-100 truncate">
                  {top3[1].userName}
                </div>
                <div className="text-[10px] text-slate-400 truncate">{top3[1].studentClass}</div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-black">
                  <Zap className="w-2.5 h-2.5 text-slate-300" />
                  <span>{top3[1].score} pts</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 mb-2">Menunggu...</div>
            )}
            <div className="w-full h-24 sm:h-32 rounded-t-2xl bg-gradient-to-t from-slate-800 to-slate-700/80 border-t-2 border-slate-400 flex flex-col items-center justify-center text-slate-300 shadow-inner">
              <span className="text-2xl sm:text-3xl font-black">2</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Perak</span>
            </div>
          </div>

          {/* Rank 1 (Gold) */}
          <div className="flex flex-col items-center">
            {top3[0] ? (
              <div className="text-center space-y-1.5 mb-2 w-full px-1">
                <div className="relative inline-block">
                  <Crown className="w-6 h-6 text-amber-400 absolute -top-4 left-1/2 -translate-x-1/2 animate-bounce" />
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-amber-950 font-black text-sm sm:text-lg flex items-center justify-center mx-auto shadow-xl border-2 border-amber-200 ring-4 ring-amber-400/40">
                    {top3[0].userName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="font-black text-xs sm:text-base text-amber-200 truncate">
                  {top3[0].userName}
                </div>
                <div className="text-[10px] text-amber-300/80 truncate">{top3[0].studentClass}</div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/60 text-amber-300 text-xs font-black shadow-xs">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>{top3[0].score} pts</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-500 mb-2">Menunggu...</div>
            )}
            <div className="w-full h-32 sm:h-44 rounded-t-2xl bg-gradient-to-t from-amber-950/80 to-amber-700/80 border-t-2 border-amber-300 flex flex-col items-center justify-center text-amber-200 shadow-xl ring-2 ring-amber-500/20">
              <span className="text-3xl sm:text-4xl font-black">1</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Emas</span>
            </div>
          </div>

          {/* Rank 3 (Bronze) */}
          <div className="flex flex-col items-center">
            {top3[2] ? (
              <div className="text-center space-y-1.5 mb-2 w-full px-1">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-800 to-amber-600 text-amber-100 font-black text-xs sm:text-base flex items-center justify-center mx-auto shadow-lg border-2 border-amber-700 ring-2 ring-amber-700/40">
                  {top3[2].userName.charAt(0).toUpperCase()}
                </div>
                <div className="font-extrabold text-xs sm:text-sm text-slate-200 truncate">
                  {top3[2].userName}
                </div>
                <div className="text-[10px] text-slate-400 truncate">{top3[2].studentClass}</div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-amber-400 text-[10px] font-black">
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  <span>{top3[2].score} pts</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 mb-2">Menunggu...</div>
            )}
            <div className="w-full h-20 sm:h-28 rounded-t-2xl bg-gradient-to-t from-slate-900 to-amber-950/60 border-t-2 border-amber-700 flex flex-col items-center justify-center text-amber-400 shadow-inner">
              <span className="text-2xl sm:text-3xl font-black">3</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Perunggu</span>
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
            <span className={`text-xs font-bold uppercase ${stats.locked > 0 ? "text-rose-700" : ""}`}>
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
            { key: "ALL", label: `Semua (${rawAttempts.length})` },
            { key: "IN_PROGRESS", label: `Mengerjakan (${stats.inProgress})` },
            { key: "LOCKED", label: `Terkunci (${stats.locked})` },
            { key: "SUBMITTED", label: `Selesai (${stats.submitted})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
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
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="SCORE">Urut: Skor Tertinggi 🏆</option>
            <option value="PROGRESS">Urut: Progres Terbanyak 📑</option>
            <option value="STRIKES">Urut: Pelanggaran Terbanyak ⚠️</option>
          </select>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari siswa..."
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Realtime Live Proctor Leaderboard List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Peserta Ujian CBT ({processedAttempts.length})</span>
          </h3>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Live Sync Aktif (Interval 3 Detik)</span>
          </div>
        </div>

        {processedAttempts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Tidak ada peserta yang cocok dengan kriteria filter saat ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {processedAttempts.map((att, idx) => {
              const isLocked = att.status === "LOCKED";
              const isDisqualified = att.status === "DISQUALIFIED";
              const isSubmitted = att.status === "SUBMITTED" || att.status === "GRADED";
              const isInProgress = att.status === "IN_PROGRESS";
              const isProcessing = actionLoadingId === att.id;

              return (
                <div
                  key={att.id}
                  className={`p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 transition-colors ${
                    isLocked
                      ? "bg-rose-50/60 hover:bg-rose-50"
                      : isDisqualified
                      ? "bg-slate-50/80 opacity-70"
                      : "hover:bg-slate-50/80"
                  }`}
                >
                  {/* Left: Rank & User Profile */}
                  <div className="flex items-center gap-3.5 min-w-[220px]">
                    {/* Rank Badge */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
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

                    <div className="space-y-0.5">
                      <div className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                        <span>{att.userName}</span>
                        {isLocked && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-black border border-rose-200 animate-pulse">
                            Terkunci
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="font-semibold text-slate-600">{att.studentClass || "Tanpa Kelas"}</span>
                        <span>•</span>
                        <span>{att.phoneNumber}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Live Quizizz Progress Bar & Realtime Score */}
                  <div className="flex-1 max-w-md space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium flex items-center gap-1 text-[11px]">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <span>
                          {att.answeredCount} / {att.totalQuestions} Soal Terjawab ({att.progressPercentage}%)
                        </span>
                      </span>

                      {/* Live Score Pill */}
                      <span
                        className={`font-mono font-black text-xs px-2.5 py-0.5 rounded-lg border flex items-center gap-1 ${
                          isDisqualified
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs"
                        }`}
                      >
                        <Zap className="w-3 h-3 text-emerald-600" />
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
                  </div>

                  {/* Right: Strike Indicator & Supervisor Action Buttons */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                    {/* Strike Badge */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono font-bold text-[11px] px-2 py-1 rounded-xl border flex items-center gap-1 ${
                          att.strikeCount >= (quiz?.maxStrikes || 3)
                            ? "bg-rose-100 text-rose-800 border-rose-300 font-black"
                            : att.strikeCount > 0
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                        title="Jumlah Peringatan Pelanggaran Siswa"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>
                          {att.strikeCount} / {quiz?.maxStrikes || 3} Strike
                        </span>
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {isLocked && (
                        <button
                          type="button"
                          onClick={() => handleAction(att.id, att.userName, "UNLOCK")}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                          title="Buka Kunci Ujian Siswa"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Buka Kunci</span>
                        </button>
                      )}

                      {isInProgress && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAction(att.id, att.userName, "RESET_STRIKES")}
                            disabled={isProcessing}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                            title="Reset Pelanggaran Siswa ke 0"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAction(att.id, att.userName, "FORCE_SUBMIT")}
                            disabled={isProcessing}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
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
                          onClick={() => handleAction(att.id, att.userName, "DISQUALIFY")}
                          disabled={isProcessing}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
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
