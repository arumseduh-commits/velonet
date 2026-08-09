"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle,
  UserX,
  Clock,
  ShieldAlert,
  Send,
  Download,
  Bot,
  ArrowRight,
  RefreshCw,
  Sparkles,
  CalendarCheck,
} from "lucide-react";

interface DashboardStats {
  total: number;
  completed: number;
  optedOut: number;
  waitingConfirmation: number;
  inProgress: number;
  excluded: number;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminderRunning, setReminderRunning] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleTriggerReminder = async () => {
    setReminderRunning(true);
    setReminderMessage(null);
    try {
      const res = await fetch("/api/cron/reminder", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setReminderMessage(json.message);
        fetchStats();
      } else {
        setReminderMessage(`Gagal: ${json.error}`);
      }
    } catch (err: any) {
      setReminderMessage(`Error: ${err.message}`);
    } finally {
      setReminderRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Overview Dashboard <Sparkles className="w-5 h-5 text-amber-400" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Ringkasan status pendaftaran ekskul Bahasa Inggris Velocity & aktivitas bot
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleTriggerReminder}
            disabled={reminderRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            {reminderRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Jalankan Pengingat (Cron)</span>
          </button>

          <a
            href="/api/participants/export?format=excel"
            download
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Excel</span>
          </a>
        </div>
      </div>

      {reminderMessage && (
        <div className="p-4 rounded-xl bg-blue-900/30 border border-blue-500/30 text-blue-300 text-sm flex items-center justify-between">
          <span>{reminderMessage}</span>
          <button
            onClick={() => setReminderMessage(null)}
            className="text-xs text-blue-400 underline hover:text-blue-200"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <div className="p-5 rounded-2xl glass-card border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Total Peserta
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white">
              {loading ? "-" : stats?.total ?? 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Terdaftar dalam database</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-5 rounded-2xl glass-card border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">
              Selesai (Lanjut)
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-emerald-400">
              {loading ? "-" : stats?.completed ?? 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Isi data lengkap (Status: COMPLETED)</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-2xl glass-card border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-400 uppercase tracking-wider">
              Batal / Kick List
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <UserX className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-rose-400">
              {loading ? "-" : stats?.optedOut ?? 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Jawab TIDAK (Status: OPTED_OUT)</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-2xl glass-card border border-slate-800 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">
              Menunggu Balasan
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-400">
              {loading ? "-" : stats?.waitingConfirmation ?? 0}
            </div>
            <p className="text-xs text-slate-400 mt-1">Belum membalas pesan bot</p>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/participants"
          className="p-6 rounded-2xl glass-panel hover:bg-slate-800/80 transition-all border border-slate-800 group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-white group-hover:text-blue-400 transition-colors">
              Kelola Data Peserta
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Lihat tabel lengkap pendaftaran, filter berdasarkan status, cari nama/nomor HP, dan detail formulir.
            </p>
          </div>
          <div className="mt-6 flex items-center text-xs font-semibold text-blue-400 group-hover:translate-x-1 transition-transform gap-1">
            <span>Buka Tabel Peserta</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        <Link
          href="/admin/kick-list"
          className="p-6 rounded-2xl glass-panel hover:bg-slate-800/80 transition-all border border-slate-800 group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
              <UserX className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-white group-hover:text-rose-400 transition-colors">
              Daftar Kick List (TIDAK)
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Daftar anggota yang mengonfirmasi TIDAK lanjut ekskul. Tandai anggota yang sudah di-kick dari grup WA.
            </p>
          </div>
          <div className="mt-6 flex items-center text-xs font-semibold text-rose-400 group-hover:translate-x-1 transition-transform gap-1">
            <span>Buka Kick List</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        <Link
          href="/admin/sessions"
          className="p-6 rounded-2xl glass-panel hover:bg-slate-800/80 transition-all border border-slate-800 group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg text-white group-hover:text-emerald-400 transition-colors">
              Sesi Absensi Pertemuan
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Jadwalkan kumpul sore, tentukan lokasi GPS tempat kumpul, broadcast pengumuman WA, dan rekap kehadiran.
            </p>
          </div>
          <div className="mt-6 flex items-center text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform gap-1">
            <span>Buka Sesi Absensi</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>
    </div>
  );
}
