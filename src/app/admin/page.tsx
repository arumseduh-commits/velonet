"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  CheckCircle,
  UserX,
  Clock,
  Send,
  Download,
  Bot,
  ArrowRight,
  RefreshCw,
  Sparkles,
  CalendarCheck,
  BookOpen,
  FolderKanban,
  Camera,
  BarChart3,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface DashboardStats {
  total: number;
  completed: number;
  optedOut: number;
  waitingConfirmation: number;
  inProgress: number;
  excluded: number;
  articlesCount?: number;
  coursesCount?: number;
  sessionsCount?: number;
  activeSessionsCount?: number;
  attendancesCount?: number;
  faceRegisteredCount?: number;
}

export default function AdminOverviewPage() {
  const { toast } = useDialog();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminderRunning, setReminderRunning] = useState(false);

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
    toast.info("Menjalankan tugas Cron Pengingat WA...");
    try {
      const res = await fetch("/api/cron/reminder", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Pengingat berhasil dikirim!");
        fetchStats();
      } else {
        toast.error(`Gagal: ${json.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setReminderRunning(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 pb-20">
      {/* 1. Header Banner & Quick Action Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/30 border border-blue-500/25 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              LMS & Community Command Center
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            <span>Overview Sistem Velocity</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitoring pendaftaran anggota, bank materi MisterGuru, katalog kursus, dan sesi presensi GPS/Face ID
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          <button
            onClick={handleTriggerReminder}
            disabled={reminderRunning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
          >
            {reminderRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Cron Pengingat WA</span>
          </button>

          <Link
            href="/admin/face-terminal"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Terminal Wajah</span>
          </Link>

          <a
            href="/api/participants/export?format=excel"
            download
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Excel</span>
          </a>
        </div>
      </div>

      {/* 2. Core Metrics Grid (6 Cards: 2 cols on mobile, 3 cols on tablet, 6 cols on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Peserta */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Siswa</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-black text-white">{loading ? "-" : stats?.total ?? 0}</p>
          <p className="text-[10px] text-slate-500 truncate">Database Peserta</p>
        </div>

        {/* Selesai Daftar */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Terdaftar Aktif</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{loading ? "-" : stats?.completed ?? 0}</p>
          <p className="text-[10px] text-slate-500 truncate">Profil Lengkap</p>
        </div>

        {/* Materi Scraped */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Bank Materi</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-400">{loading ? "-" : stats?.articlesCount ?? 0}</p>
          <p className="text-[10px] text-slate-500 truncate">MisterGuru Hub</p>
        </div>

        {/* Kursus & Modul */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Katalog Kursus</span>
            <FolderKanban className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-indigo-400">{loading ? "-" : stats?.coursesCount ?? 0}</p>
          <p className="text-[10px] text-slate-500 truncate">Modul Terstruktur</p>
        </div>

        {/* Total Kehadiran */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 hover:border-teal-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Presensi Sesi</span>
            <CalendarCheck className="w-4 h-4 text-teal-400" />
          </div>
          <p className="text-2xl font-black text-teal-400">{loading ? "-" : stats?.attendancesCount ?? 0}</p>
          <p className="text-[10px] text-slate-500 truncate">Total Check-In</p>
        </div>

        {/* Wajah Biometrik */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1 hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Face ID</span>
            <ShieldCheck className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400">{loading ? "-" : stats?.faceRegisteredCount ?? 0}</p>
          <p className="text-[10px] text-slate-500 truncate">Vektor Wajah</p>
        </div>
      </div>

      {/* 3. Four Core Modules Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Module 1: LMS Scraper */}
        <Link
          href="/admin/learning"
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/40 transition-all group flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-blue-300 transition-colors">
              MisterGuru Scraper Hub
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Scraping artikel edukasi bahasa Inggris, parsing kuis otomatis, dan sinkronisasi ke bank materi.
            </p>
          </div>
          <div className="flex items-center text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform gap-1">
            <span>Buka Scraper Hub</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Module 2: Kursus & Modul */}
        <Link
          href="/admin/courses"
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-all group flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
              <FolderKanban className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
              Katalog Kursus & Bab
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Kelola kurikulum pembelajaran terstruktur, bab pelajaran, video, dan tugas siswa.
            </p>
          </div>
          <div className="flex items-center text-xs font-bold text-indigo-400 group-hover:translate-x-1 transition-transform gap-1">
            <span>Kelola Kursus</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Module 3: Sesi Absensi & Terminal */}
        <Link
          href="/admin/sessions"
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all group flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
              Sesi Absensi & Radar GPS
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Buat jadwal kumpul, atur titik koordinat GPS & radius geofence, dan rekap kehadiran.
            </p>
          </div>
          <div className="flex items-center text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform gap-1">
            <span>Kelola Sesi</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>

        {/* Module 4: Data Peserta & Bot */}
        <Link
          href="/admin/participants"
          className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 transition-all group flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors">
              Data Peserta & Bot WA
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Tabel lengkap pendaftaran siswa, status kick list, filter kelas, dan ekspor data Excel.
            </p>
          </div>
          <div className="flex items-center text-xs font-bold text-amber-400 group-hover:translate-x-1 transition-transform gap-1">
            <span>Data Peserta</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>
    </div>
  );
}
