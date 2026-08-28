"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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
  Eye,
  ArrowLeft,
  ChevronRight,
  Send,
  UserX,
  RotateCcw,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

export default function ExamProctorControlRoom() {
  const router = useRouter();
  const params = useParams();
  const quizId = params.quizId as string;
  const { confirm, toast } = useDialog();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
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

  // Initial fetch and automatic real-time polling every 3.5s
  useEffect(() => {
    fetchProctorData();
    const interval = setInterval(() => {
      fetchProctorData(false);
    }, 3500);

    return () => clearInterval(interval);
  }, [fetchProctorData]);

  // Handle Supervisor Actions
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
      confirmMsg = `Buka kembali ujian untuk ${studentName}? Pelanggaran akan disetel ulang agar siswa bisa melanjutkan.`;
      confirmVariant = "info";
    } else if (action === "RESET_STRIKES") {
      confirmTitle = "Setel Ulang Pelanggaran";
      confirmMsg = `Reset poin pelanggaran ${studentName} menjadi 0?`;
      confirmVariant = "warning";
    } else if (action === "FORCE_SUBMIT") {
      confirmTitle = "Kumpulkan Paksa Ujian";
      confirmMsg = `Kumpulkan paksa ujian untuk ${studentName} sekarang? Jawaban yang tersimpan akan langsung dinilai.`;
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

  if (loading && !data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-semibold">Memuat Live Control Room...</p>
      </div>
    );
  }

  const quiz = data?.quiz;
  const stats = data?.stats || {
    totalParticipants: 0,
    inProgress: 0,
    locked: 0,
    submitted: 0,
    disqualified: 0,
  };
  const attempts = data?.attempts || [];

  // Filter attempts
  const filteredAttempts = attempts.filter((att: any) => {
    const matchesSearch =
      att.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      att.phoneNumber.includes(searchQuery) ||
      att.studentClass.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === "ALL") return true;
    return att.status === statusFilter;
  });

  return (
    <div className="space-y-6 pb-20">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors border border-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Live Proctoring Room
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-blue-600" />
              <span>{quiz?.title || "Ujian CBT"}</span>
            </h1>
          </div>
        </div>

        {/* Right Tools: Supervisor PIN & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900 text-white shadow-sm border border-slate-800">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <div className="text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">PIN Pengawas</span>
              <span className="font-mono font-bold tracking-wider text-amber-300 text-sm">
                {quiz?.supervisorPin || "123456"}
              </span>
            </div>
          </div>

          <button
            onClick={() => fetchProctorData(true)}
            disabled={refreshing}
            className="p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors border border-blue-200 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
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
          className={`p-4 rounded-2xl border shadow-xs ${
            stats.locked > 0 ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400/30" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className={`text-xs font-bold uppercase ${stats.locked > 0 ? "text-rose-700" : ""}`}>
              Terkunci (Perlu Aksi)
            </span>
            <Lock className={`w-4 h-4 ${stats.locked > 0 ? "text-rose-600 animate-bounce" : "text-slate-400"}`} />
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

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { key: "ALL", label: "Semua" },
            { key: "LOCKED", label: "Terkunci" },
            { key: "IN_PROGRESS", label: "Mengerjakan" },
            { key: "SUBMITTED", label: "Selesai" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                statusFilter === tab.key
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari siswa atau kelas..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden text-slate-900"
          />
        </div>
      </div>

      {/* Students Live List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Daftar Peserta Ujian ({filteredAttempts.length})</span>
          </h3>
          <span className="text-[11px] text-slate-400">Pembaruan otomatis tiap 3.5 detik</span>
        </div>

        {filteredAttempts.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Tidak ada data peserta yang cocok dengan filter saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
                  <th className="py-3.5 px-4">Nama Siswa</th>
                  <th className="py-3.5 px-4">Status Ujian</th>
                  <th className="py-3.5 px-4">Pelanggaran (Strike)</th>
                  <th className="py-3.5 px-4">Nilai / Hasil</th>
                  <th className="py-3.5 px-4">Log Terakhir</th>
                  <th className="py-3.5 px-4 text-right">Aksi Pengawas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAttempts.map((att: any) => {
                  const isAttemptLocked = att.status === "LOCKED";
                  const isProcessing = actionLoadingId === att.id;

                  return (
                    <tr key={att.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Siswa Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{att.userName}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{att.studentClass || "Tanpa Kelas"}</span>
                          <span>•</span>
                          <span>{att.phoneNumber}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {att.status === "IN_PROGRESS" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            Mengerjakan
                          </span>
                        )}
                        {att.status === "LOCKED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-bold text-[11px] border border-rose-200 animate-pulse">
                            <Lock className="w-3 h-3" />
                            Terkunci
                          </span>
                        )}
                        {att.status === "SUBMITTED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Selesai
                          </span>
                        )}
                        {att.status === "DISQUALIFIED" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] border border-slate-300">
                            <XCircle className="w-3 h-3" />
                            Didiskualifikasi
                          </span>
                        )}
                      </td>

                      {/* Strike Count */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-mono font-bold px-2 py-0.5 rounded-md text-xs ${
                              att.strikeCount >= (quiz?.maxStrikes || 3)
                                ? "bg-rose-100 text-rose-700 border border-rose-200 font-black"
                                : att.strikeCount > 0
                                ? "bg-amber-100 text-amber-700 border border-amber-200"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {att.strikeCount} / {quiz?.maxStrikes || 3}
                          </span>
                        </div>
                      </td>

                      {/* Score */}
                      <td className="py-3.5 px-4">
                        {att.status === "SUBMITTED" ? (
                          <div className="font-bold text-slate-900 text-sm">
                            {att.score} <span className="text-slate-400 font-normal text-xs">/ {att.totalScore}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Recent Violation */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {att.violations && att.violations.length > 0 ? (
                          <div className="text-[11px] text-slate-600">
                            <strong className="text-rose-600 font-semibold">{att.violations[0].type}</strong>
                            <p className="truncate text-slate-500">{att.violations[0].description}</p>
                          </div>
                        ) : (
                          <span className="text-emerald-600 text-[11px] font-medium flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Bersih
                          </span>
                        )}
                      </td>

                      {/* Supervisor Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isAttemptLocked && (
                            <button
                              onClick={() => handleAction(att.id, att.userName, "UNLOCK")}
                              disabled={isProcessing}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                              title="Buka Kunci Ujian"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>Buka Kunci</span>
                            </button>
                          )}

                          {att.status === "IN_PROGRESS" && (
                            <>
                              <button
                                onClick={() => handleAction(att.id, att.userName, "RESET_STRIKES")}
                                disabled={isProcessing}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                                title="Reset Strike ke 0"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleAction(att.id, att.userName, "FORCE_SUBMIT")}
                                disabled={isProcessing}
                                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                                title="Kumpulkan Paksa Ujian"
                              >
                                <Send className="w-3 h-3" />
                                <span>Kumpulkan</span>
                              </button>
                            </>
                          )}

                          {att.status !== "DISQUALIFIED" && (
                            <button
                              onClick={() => handleAction(att.id, att.userName, "DISQUALIFY")}
                              disabled={isProcessing}
                              className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                              title="Diskualifikasi Siswa"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
