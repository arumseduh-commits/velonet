"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, CalendarCheck, Clock, MapPin, Award, LogOut, CheckCircle2, AlertTriangle, FileText, Navigation, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface StudentProfile {
  id: string;
  name: string;
  phoneNumber: string;
  studentClass: string;
  motivation: string;
  hobby: string;
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

export default function StudentDashboardPage() {
  const router = useRouter();
  const { toast } = useDialog();

  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/student/auth/me");
      const json = await res.json();
      if (json.success) {
        setStudent(json.data.student);
        setStats(json.data.stats);
        setRecords(json.data.recentAttendances);
      } else {
        router.push("/student/login");
      }
    } catch (err) {
      console.error("Failed to fetch student data:", err);
      router.push("/student/login");
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

  // Perform Web GPS Check-In
  const handleWebCheckIn = () => {
    if (!navigator.geolocation) {
      toast.error("Browser Anda tidak mendukung lokasi GPS.");
      return;
    }

    setCheckingIn(true);
    toast.info("Mengambil lokasi GPS Anda...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch("/api/student/attendance/check-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          });
          const json = await res.json();
          if (json.success) {
            toast.success(json.message || "Absensi GPS berhasil dicatat!");
            fetchStudentData();
          } else {
            toast.error(json.error || "Gagal melakukan absensi GPS.");
          }
        } catch (err: any) {
          toast.error(err.message || "Gagal menghubungi server.");
        } finally {
          setCheckingIn(false);
        }
      },
      (err) => {
        toast.error(`Gagal mendapatkan lokasi GPS: ${err.message}`);
        setCheckingIn(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
        <span className="text-sm font-medium">Memuat Portal Siswa Velocity...</span>
      </div>
    );
  }

  const badgeTitle =
    (stats?.ratePercentage || 0) >= 90
      ? "🌟 Velocity Star (Sangat Rajin)"
      : (stats?.ratePercentage || 0) >= 75
      ? "🥇 Active Member"
      : "🎗️ Member Velocity";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-emerald-500/20 shrink-0">
            {student?.name?.charAt(0).toUpperCase() || "S"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                {student?.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                Kelas {student?.studentClass}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>No. WA: +{student?.phoneNumber}</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold">{badgeTitle}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Keluar Portal</span>
          </button>
        </div>
      </div>

      {/* Quick Action Banner: Web GPS Check-In Button */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="space-y-1 text-center sm:text-left">
          <h2 className="text-base font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
            <Navigation className="w-5 h-5 text-emerald-400" />
            <span>Absensi GPS Langsung dari Browser</span>
          </h2>
          <p className="text-xs text-slate-400">
            Saat kumpul di lokasi sore ini, Anda bisa menekan tombol di samping untuk absen GPS tanpa membuka WA!
          </p>
        </div>

        <button
          onClick={handleWebCheckIn}
          disabled={checkingIn}
          className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {checkingIn ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Memproses Lokasi GPS...</span>
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4" />
              <span>Absen GPS Sekarang</span>
            </>
          )}
        </button>
      </div>

      {/* Stat Cards Grid (Mobile Responsive: grid-cols-1 sm:grid-cols-2 md:grid-cols-4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl glass-panel border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Kehadiran</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {stats?.hadirCount || 0} <span className="text-xs text-slate-400 font-normal">Sesi</span>
          </p>
          <p className="text-[11px] text-slate-500">Hadir tepat waktu di lokasi</p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Izin / Sakit</span>
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {stats?.izinCount || 0} <span className="text-xs text-slate-400 font-normal">Sesi</span>
          </p>
          <p className="text-[11px] text-slate-500">Izin dikonfirmasi via Bot</p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Alpa</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400">
            {stats?.alpaCount || 0} <span className="text-xs text-slate-400 font-normal">Sesi</span>
          </p>
          <p className="text-[11px] text-slate-500">Tanpa keterangan hadir</p>
        </div>

        <div className="p-4 rounded-2xl glass-panel border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Tingkat Rajin</span>
            <Award className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {stats?.ratePercentage || 0}%
          </p>
          <p className="text-[11px] text-slate-500">Dari total {stats?.totalSessions || 0} sesi</p>
        </div>
      </div>

      {/* Attendance History Table Card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-emerald-400" />
            <span>Riwayat Absensi Sesi Pertemuan</span>
          </h2>
        </div>

        <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Nama Sesi</th>
                  <th className="py-3.5 px-4">Waktu Check-In</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Metode</th>
                  <th className="py-3.5 px-4">Jarak GPS</th>
                  <th className="py-3.5 px-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-200">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Belum ada riwayat absensi sesi pertemuan.
                    </td>
                  </tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {r.sessionTitle}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono">
                        {new Date(r.checkInTime).toLocaleString("id-ID")}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            r.status === "HADIR"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : r.status === "IZIN" || r.status === "SAKIT"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {r.method === "LOCATION_GPS"
                          ? "📍 Share Location WA"
                          : r.method === "WEB_GPS"
                          ? "🌐 Browser GPS Web"
                          : "✍️ Manual Admin"}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-emerald-400">
                        {r.distanceMeter != null ? `${r.distanceMeter}m` : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
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
