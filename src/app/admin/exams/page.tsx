"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  BrainCircuit,
  Clock,
  KeyRound,
  Users,
  Lock,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Search,
  Plus,
  Camera,
  Maximize,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

export default function AdminExamsListPage() {
  const { toast } = useDialog();
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchExams = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/exams");
      const json = await res.json();
      if (json.success && json.data) {
        setExams(json.data);
      }
    } catch (err) {
      toast.error("Gagal memuat daftar ujian.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const filteredExams = exams.filter((e) =>
    e.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalInProgress = exams.reduce((acc, e) => acc + (e.stats?.inProgress || 0), 0);
  const totalLocked = exams.reduce((acc, e) => acc + (e.stats?.locked || 0), 0);

  return (
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
            <span>VeloExambro Control Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Pusat Ujian Aman & Anti-Kecurangan
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
            Pantau dan amankan ujian CBT secara real-time. Dilengkapi deteksi perpindahan tab, penguncian layar, dan AI Face Proctoring langsung di browser.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <Link
            href="/admin/learning"
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs shadow-md shadow-amber-500/25 transition-all flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>✨ Buat Soal AI Assistant</span>
          </Link>

          <button
            onClick={fetchExams}
            disabled={loading}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10 cursor-pointer flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Total Modul Ujian</span>
            <div className="text-2xl font-black text-slate-900 mt-1">{exams.length}</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <BrainCircuit className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Sedang Mengerjakan</span>
            <div className="text-2xl font-black text-emerald-600 mt-1">{totalInProgress} Siswa</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div
          className={`p-5 rounded-3xl border shadow-xs flex items-center justify-between ${
            totalLocked > 0 ? "bg-rose-50 border-rose-300 ring-2 ring-rose-400/30" : "bg-white border-slate-200"
          }`}
        >
          <div>
            <span className={`text-xs font-bold uppercase ${totalLocked > 0 ? "text-rose-700" : "text-slate-400"}`}>
              Siswa Terkunci (Strike)
            </span>
            <div className={`text-2xl font-black mt-1 ${totalLocked > 0 ? "text-rose-600" : "text-slate-900"}`}>
              {totalLocked} Siswa
            </div>
          </div>
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              totalLocked > 0 ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-400"
            }`}
          >
            <Lock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari modul ujian CBT..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-hidden text-slate-900"
          />
        </div>
      </div>

      {/* Exams Grid */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-400 text-xs">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
          <span>Memuat modul ujian CBT...</span>
        </div>
      ) : filteredExams.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
          Belum ada modul ujian CBT yang terdaftar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExams.map((exam) => {
            const hasLocked = exam.stats?.locked > 0;
            const hasActive = exam.stats?.inProgress > 0;

            return (
              <div
                key={exam.id}
                className={`bg-white rounded-3xl p-6 border shadow-sm transition-all hover:shadow-md flex flex-col justify-between space-y-5 ${
                  hasLocked ? "border-rose-300 ring-2 ring-rose-400/20" : "border-slate-200"
                }`}
              >
                <div>
                  {/* Top Meta */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 flex items-center gap-1">
                      <BrainCircuit className="w-3.5 h-3.5" />
                      <span>{exam.questionCount} Soal</span>
                    </span>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.durationMinutes} Menit</span>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-extrabold text-slate-900 text-base mt-3 line-clamp-2">
                    {exam.title}
                  </h3>
                  {exam.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{exam.description}</p>
                  )}

                  {/* Security Badges */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {exam.enableFullscreenLock && (
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Maximize className="w-3 h-3" /> Fullscreen Lock
                      </span>
                    )}
                    {exam.enableCameraProctor && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Camera className="w-3 h-3" /> AI Proctor
                      </span>
                    )}
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Max {exam.maxStrikes} Strikes
                    </span>
                  </div>

                  {/* PIN & Live Activity */}
                  <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                      <span>PIN: <strong className="font-mono text-slate-900">{exam.supervisorPin || "123456"}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasActive && (
                        <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                          {exam.stats.inProgress} Mengerjakan
                        </span>
                      )}
                      {hasLocked && (
                        <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          {exam.stats.locked} Terkunci
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
                  <Link
                    href={`/admin/exams/${exam.id}/proctor`}
                    className={`flex-1 py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all ${
                      hasLocked
                        ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/25 animate-pulse"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25"
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Live Proctoring</span>
                  </Link>

                  <Link
                    href={`/student/quiz/${exam.id}`}
                    target="_blank"
                    className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors border border-slate-200"
                    title="Pratinjau Tampilan Siswa"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
