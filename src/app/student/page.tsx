"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  CalendarCheck,
  Clock,
  MapPin,
  Award,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Navigation,
  RefreshCw,
  Sparkles,
  User,
  GraduationCap,
  Heart,
  Target,
  Send,
  ShieldCheck,
  Camera,
  BookOpen,
  BrainCircuit,
  Trophy,
  Flame,
  ChevronRight,
  ArrowRight,
  BookMarked,
  Layers,
  ShieldAlert,
  KeyRound,
  Lock,
  Edit3,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface StudentProfile {
  id: string;
  name: string;
  phoneNumber: string;
  studentClass: string;
  motivation: string;
  hobby: string;
  gender: string;
  status: string;
  isFaceRegistered?: boolean;
}

interface Stats {
  totalSessions: number;
  hadirCount: number;
  izinCount: number;
  alpaCount: number;
  ratePercentage: number;
}

interface AttendanceRecord {
  id: string;
  sessionTitle: string;
  sessionDate: string;
  status: string;
  method: string;
  checkInTime: string;
  distanceMeter: number | null;
  notes: string | null;
}

interface FeaturedMaterial {
  id: string;
  title: string;
  category: string;
  level: string;
  summary: string;
  readTime: string;
  quizCount: number;
}

export default function StudentDashboardPage() {
  const router = useRouter();
  const { toast } = useDialog();

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [featuredMaterials, setFeaturedMaterials] = useState<FeaturedMaterial[]>([]);
  const [studentExams, setStudentExams] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<{
    id: string;
    title: string;
    locationName: string | null;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const [meRes, matRes, sessRes, examRes] = await Promise.all([
        fetch("/api/student/auth/me"),
        fetch("/api/learning/articles"),
        fetch("/api/attendance/active-locations"),
        fetch("/api/student/exams"),
      ]);

      const json = await meRes.json();
      if (json.success && json.data?.student) {
        const isCompleted =
          json.data.student.status === "COMPLETED" ||
          Boolean(
            json.data.student.name &&
            json.data.student.name !== "Siswa Baru" &&
            json.data.student.studentClass
          );

        if (!isCompleted || !json.data.student.name || json.data.student.name === "Siswa Baru") {
          router.replace("/student/complete-profile");
          return;
        }
        setStudent(json.data.student);
        setStats(json.data.stats);
        setRecords(json.data.recentAttendances || []);
      } else {
        router.replace("/student/login");
        return;
      }

      // Fetch featured learning materials
      const matJson = await matRes.json();
      if (matJson.success && Array.isArray(matJson.data)) {
        const mapped = matJson.data.slice(0, 3).map((m: any) => ({
          id: m.id,
          title: m.title,
          category: m.category || "General",
          level: m.level || "Intermediate",
          summary: m.summary || "Pelajari materi ini untuk mengasah kemampuan bahasa Inggris.",
          readTime: m.readTime || "5 min read",
          quizCount: m.quiz ? m.quiz.length : 3,
        }));
        setFeaturedMaterials(mapped);
      }

      // Fetch active session if any
      const sessJson = await sessRes.json();
      if (sessJson.success && Array.isArray(sessJson.data) && sessJson.data.length > 0) {
        setActiveSession(sessJson.data[0]);
      }

      // Fetch CBT exams
      const examJson = await examRes.json();
      if (examJson.success && Array.isArray(examJson.data)) {
        setStudentExams(examJson.data);
      }
    } catch (err) {
      console.error("Failed to fetch student data:", err);
      router.replace("/student/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/student/auth/logout", { method: "POST" });
      toast.info("Anda telah keluar dari Portal Siswa.");
      router.push("/student/login");
    } catch (e) {
      router.push("/student/login");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="text-sm font-medium">Menyiapkan Dashboard Siswa VeloNet...</span>
      </div>
    );
  }

  const isRegistrationIncomplete =
    !student ||
    (student.status !== "COMPLETED" && !(student.name && student.studentClass)) ||
    !student.name ||
    student.name === "Siswa Baru";

  if (isRegistrationIncomplete) {
    if (typeof window !== "undefined") {
      router.push("/student/complete-profile");
    }
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="text-sm font-medium">Mengalihkan ke formulir pendaftaran...</span>
      </div>
    );
  }

  const badgeTitle =
    (stats?.ratePercentage || 0) >= 90
      ? "Velocity Star"
      : (stats?.ratePercentage || 0) >= 75
      ? "Active Learner"
      : "Velocity Member";

  const learningCategories = [
    { title: "Grammar Guide", count: "12 Topik", icon: BookMarked, color: "text-blue-600", bg: "bg-blue-50/70 border-blue-200 hover:border-blue-300 hover:bg-blue-50" },
    { title: "Speaking & Dialogues", count: "8 Dialog", icon: Sparkles, color: "text-teal-600", bg: "bg-teal-50/70 border-teal-200 hover:border-teal-300 hover:bg-teal-50" },
    { title: "TOEIC & Test Preps", count: "15 Soal", icon: Target, color: "text-purple-600", bg: "bg-purple-50/70 border-purple-200 hover:border-purple-300 hover:bg-purple-50" },
    { title: "Vocabulary Builder", count: "100+ Kata", icon: BrainCircuit, color: "text-amber-600", bg: "bg-amber-50/70 border-amber-200 hover:border-amber-300 hover:bg-amber-50" },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 pb-24 md:pb-12 text-slate-900">
      {/* 1. HERO USER BANNER */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white border border-emerald-200/80 shadow-xs text-slate-900">
        {/* Subtle background decorative shapes */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-teal-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* User Info Left */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center text-white font-black text-2xl sm:text-3xl shadow-sm shadow-emerald-500/20 ring-4 ring-white shrink-0">
                {student?.name?.charAt(0).toUpperCase() || "S"}
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-xs" title="Akun Aktif">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {student?.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold">
                  Kelas {student?.studentClass}
                </span>
              </div>
              <p className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>{badgeTitle}</span>
                </span>
                <span>•</span>
                <span className="text-slate-500 font-medium">WA: +{student?.phoneNumber}</span>
              </p>
            </div>
          </div>

          {/* Quick Action Buttons Right */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <Link
              href="/student/exams"
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold text-xs shadow-xs btn-press transition-all cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-indigo-100" />
              <span>Ujian CBT</span>
            </Link>

            <Link
              href="/student/learning"
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs btn-press transition-all cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-blue-100" />
              <span>Materi LMS</span>
            </Link>

            <Link
              href="/student/attendance"
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs btn-press transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4 text-emerald-100" />
              <span>Absen Wajah</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE SESSION RADAR (If a meeting session is currently active) */}
      {activeSession && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-900">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-300 shrink-0">
              <MapPin className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold animate-pulse">
                  SESI BERJALAN SEKARANG
                </span>
                <h3 className="text-sm font-bold text-slate-900">{activeSession.title}</h3>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Lokasi: <b>{activeSession.locationName || "Titik Kumpul"}</b> • Jam:{" "}
                {new Date(activeSession.startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} -{" "}
                {new Date(activeSession.endTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
              </p>
            </div>
          </div>

          <Link
            href="/student/attendance"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Check-in Sekarang</span>
          </Link>
        </div>
      )}

      {/* 3. FOUR CORE STATS GRID (Mobile: 1 col, Tablet: 2 cols, Desktop: 4 cols) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Kehadiran */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2 hover:border-emerald-300 transition-colors text-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Kehadiran Sesi</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">
              {stats?.hadirCount || 0}
            </span>
            <span className="text-xs text-slate-500">/ {stats?.totalSessions || 0} Pertemuan</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, stats?.ratePercentage || 0)}%` }}
            />
          </div>
        </div>

        {/* Tingkat Kerajinan */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2 hover:border-blue-300 transition-colors text-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Tingkat Rajin</span>
            <Award className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-blue-600">
              {stats?.ratePercentage || 0}%
            </span>
            <span className="text-xs text-slate-500">Rate Absensi</span>
          </div>
          <p className="text-[11px] text-slate-500 truncate">
            {stats?.izinCount || 0} Izin • {stats?.alpaCount || 0} Alpa
          </p>
        </div>

        {/* Modul & Bank Materi */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2 hover:border-purple-300 transition-colors text-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Materi Bahasa Inggris</span>
            <BookOpen className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-purple-600">
              {featuredMaterials.length > 0 ? "50+" : "0"}
            </span>
            <span className="text-xs text-slate-500">Artikel & Kuis</span>
          </div>
          <p className="text-[11px] text-slate-500">MisterGuru.web.id Hub</p>
        </div>

        {/* Face ID Status */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 rounded-2xl shadow-sm space-y-2 hover:border-teal-300 transition-colors text-slate-900">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Biometrik Face ID</span>
            <ShieldCheck className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Siap Digunakan</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium">Enkripsi 128-D Vektor</p>
        </div>
      </div>

      {/* 4. OFFICIAL CBT EXAM HUB (ExamBro Safe) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              <span>Ujian CBT Resmi</span>
            </h2>
            <p className="text-xs text-slate-500">
              Evaluasi kompetensi terstruktur dengan proteksi ExamBro
            </p>
          </div>

          <Link
            href="/student/exams"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
          >
            <span>Semua Ujian & Nilai ({studentExams.length})</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {studentExams.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-400">
            Belum ada modul ujian resmi yang diterbitkan saat ini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studentExams.slice(0, 2).map((exam) => {
              const attempt = exam.attempt;
              const isCompleted =
                attempt?.status === "SUBMITTED" ||
                attempt?.status === "GRADED" ||
                attempt?.status === "DISQUALIFIED";
              const isLocked = attempt?.status === "LOCKED";
              const isInProgress = attempt?.status === "IN_PROGRESS";

              return (
                <div
                  key={exam.id}
                  className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-indigo-300 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>ExamBro CBT</span>
                      </span>

                      {isCompleted ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Selesai</span>
                        </span>
                      ) : isLocked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>Terkunci</span>
                        </span>
                      ) : isInProgress ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                          <span>Sedang Mengerjakan</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Tersedia
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                      {exam.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                        <Clock className="w-3 h-3 text-blue-600" />
                        <span>{exam.durationMinutes} Menit</span>
                      </span>
                      <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                        <Layers className="w-3 h-3 text-indigo-600" />
                        <span>{exam.totalQuestions} Soal</span>
                      </span>
                      {exam.hasExamToken && (
                        <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg border border-purple-200 font-bold text-[10px]">
                          <KeyRound className="w-3 h-3" />
                          <span>Token</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    {isCompleted && exam.showScoreImmediately ? (
                      <span className="text-xs font-bold text-emerald-700 font-mono">
                        Nilai: {attempt?.score ?? 0} / {exam.totalPoints} Poin
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        {isCompleted ? "Menunggu verifikasi guru" : "Ujian Berbatas Waktu"}
                      </span>
                    )}

                    <Link
                      href={`/student/quiz/${exam.id}`}
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${
                        isCompleted
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          : isLocked
                          ? "bg-rose-600 hover:bg-rose-700 text-white"
                          : isInProgress
                          ? "bg-amber-500 hover:bg-amber-600 text-white"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                      }`}
                    >
                      <span>
                        {isCompleted
                          ? "Lihat Hasil"
                          : isLocked
                          ? "Buka Kunci"
                          : isInProgress
                          ? "Lanjutkan"
                          : "Mulai Ujian"}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. LEARNING LMS HUB & FEATURED TRACKS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              <span>Katalog Materi & Latihan</span>
            </h2>
            <p className="text-xs text-slate-500">Pelajari modul dan kuis evaluasi berkala</p>
          </div>

          <Link
            href="/student/learning"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
          >
            <span>Lihat Semua</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Quick Category Track Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {learningCategories.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <Link
                key={idx}
                href="/student/learning"
                className={`p-4 rounded-2xl border ${cat.bg} hover:scale-[1.02] shadow-xs btn-press transition-all flex flex-col justify-between space-y-3 cursor-pointer group`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs ${cat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{cat.count}</span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                    {cat.title}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Featured Material Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {featuredMaterials.map((item) => (
            <Link
              key={item.id}
              href="/student/learning"
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-300 btn-press transition-all flex flex-col justify-between space-y-4 group cursor-pointer text-slate-900"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                    {item.category}
                  </span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {item.readTime}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                  {item.title}
                </h4>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {item.summary}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-amber-600 text-[11px] font-semibold flex items-center gap-1">
                  <BrainCircuit className="w-3.5 h-3.5" />
                  <span>{item.quizCount} Soal Kuis</span>
                </span>

                <span className="text-blue-600 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1 text-[11px]">
                  <span>Mulai Baca</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 5. ATTENDANCE HISTORY TABLE */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
              <span>Riwayat Kehadiran</span>
            </h2>
            <p className="text-xs text-slate-500">Rekapitulasi presensi pertemuan komunitas</p>
          </div>

          <Link
            href="/student/profile"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition-colors"
          >
            <span>Semua Riwayat</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Nama Sesi</th>
                  <th className="py-3.5 px-4">Waktu Check-In</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Metode</th>
                  <th className="py-3.5 px-4">Jarak GPS</th>
                  <th className="py-3.5 px-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Belum ada riwayat absensi sesi pertemuan.
                    </td>
                  </tr>
                ) : (
                  records.slice(0, 5).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {r.sessionTitle}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono">
                        {new Date(r.checkInTime).toLocaleString("id-ID")}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            r.status === "HADIR"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : r.status === "IZIN" || r.status === "SAKIT"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {r.method === "FACE" || r.method === "FACE_RECOGNITION" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                            <Camera className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Face ID</span>
                          </span>
                        ) : r.method === "LOCATION_GPS" || r.method === "GEOFENCE" ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                            <MapPin className="w-3.5 h-3.5 text-blue-600" />
                            <span>GPS Lokasi</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                            <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                            <span>Manual</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                        {r.distanceMeter != null ? `${Math.round(r.distanceMeter)}m` : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {r.notes || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
