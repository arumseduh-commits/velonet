"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  User,
  Phone,
  BookOpen,
  Heart,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Camera,
  History,
  CalendarCheck,
  Clock,
  MapPin,
  Award,
  AlertTriangle,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface StudentData {
  id: string;
  name: string;
  phoneNumber: string;
  studentClass: string;
  motivation: string;
  hobby: string;
  isFaceRegistered?: boolean;
  facePhoto?: string | null;
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

interface Stats {
  totalSessions: number;
  hadirCount: number;
  izinCount: number;
  alpaCount: number;
  ratePercentage: number;
}

export default function StudentProfilePage() {
  const { toast } = useDialog();

  const [student, setStudent] = useState<StudentData | null>(null);
  const [motivation, setMotivation] = useState("");
  const [hobby, setHobby] = useState("");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/student/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.student) {
          const s = json.data.student;
          setStudent(s);
          setMotivation(s.motivation || "");
          setHobby(s.hobby || "");
          setRecords(json.data.recentAttendances || []);
          setStats(json.data.stats || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivation: motivation.trim(),
          hobby: hobby.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Profil Anda berhasil diperbarui!");
      } else {
        toast.error(json.error || "Gagal memperbarui profil.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui profil.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-medium">Memuat Profil Siswa...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-6 space-y-6 max-w-4xl mx-auto pb-24 md:pb-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white border border-blue-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-extrabold text-white text-3xl shadow-md shadow-blue-500/20 shrink-0">
            {student?.name?.charAt(0).toUpperCase() || "S"}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-wide flex items-center gap-2">
              <span>{student?.name}</span>
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Anggota Resmi Komunitas Ekskul Velocity • Kelas {student?.studentClass}
            </p>
          </div>
        </div>

        {stats && (
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-xs self-start sm:self-auto">
            <Award className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-slate-600 font-medium">Kehadiran:</span>
            <span className="text-xs font-bold text-emerald-700 font-mono">{stats.ratePercentage}%</span>
          </div>
        )}
      </div>

      {/* Face Biometrics Status Banner */}
      <div className="p-5 rounded-3xl bg-white border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shrink-0">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">Biometrik Wajah AI (Face ID)</h3>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                student?.isFaceRegistered
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>
                {student?.isFaceRegistered ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Terdaftar & Aktif</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    <span>Belum Direkam</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {student?.isFaceRegistered
                ? "Data biometrik Anda aktif untuk verifikasi absensi kamera di lokasi kumpul."
                : "Anda belum merekam sampel wajah. Buka menu absensi untuk merekam."}
            </p>
          </div>
        </div>

        <Link
          href="/student/attendance"
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Camera className="w-4 h-4" />
          <span>Buka Kamera Absen</span>
        </Link>
      </div>

      {/* Profile Form Card */}
      <form onSubmit={handleUpdateProfile} className="space-y-6">
        <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 tracking-wide flex items-center gap-2 pb-3 border-b border-slate-200">
            <User className="w-5 h-5 text-blue-600" />
            <span>Informasi Profil & Data Diri</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Nama Lengkap</label>
              <input
                type="text"
                value={student?.name || ""}
                disabled
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-500 cursor-not-allowed font-medium"
              />
              <p className="text-[10px] text-slate-400">Hubungi Pembina jika ada kesalahan penulisan nama.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Kelas / Tingkat</label>
              <input
                type="text"
                value={student?.studentClass || ""}
                disabled
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-500 cursor-not-allowed font-medium"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700">Nomor WhatsApp Terhubung</label>
              <div className="relative">
                <input
                  type="text"
                  value={`+${student?.phoneNumber || ""}`}
                  disabled
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono text-emerald-700 cursor-not-allowed font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500" />
                <span>Hobi & Minat</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Reading, Gaming, Listening to Music"
                value={hobby}
                onChange={(e) => setHobby(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>Motivasi Mengikuti Ekskul Velocity</span>
              </label>
              <textarea
                rows={3}
                placeholder="Tuliskan alasan & impian kamu bergabung di Velocity..."
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Perubahan Profil</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* RIWAYAT ABSENSI PERTEMUAN SISWA */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Riwayat Kehadiran & Sesi</h2>
              <p className="text-[11px] text-slate-500">Catatan kehadiran Anda pada setiap pertemuan ekskul</p>
            </div>
          </div>

          <span className="text-xs font-mono text-slate-600 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
            Total: {records.length} Pertemuan
          </span>
        </div>

        {records.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-2">
            <CalendarCheck className="w-8 h-8 mx-auto opacity-40 text-blue-600" />
            <p className="text-xs">Belum ada riwayat absensi yang tercatat.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 font-bold bg-slate-50">
                  <th className="py-3 px-3">Sesi Pertemuan</th>
                  <th className="py-3 px-3">Tanggal</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Metode</th>
                  <th className="py-3 px-3">Waktu Masuk</th>
                  <th className="py-3 px-3">Jarak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {records.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-900">
                      {rec.sessionTitle}
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                      {rec.sessionDate}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          rec.status === "HADIR"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : rec.status === "IZIN"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                        {rec.method === "FACE" ? (
                          <>
                            <Camera className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Wajah AI</span>
                          </>
                        ) : rec.method === "GEOFENCE" ? (
                          <>
                            <MapPin className="w-3.5 h-3.5 text-blue-600" />
                            <span>GPS</span>
                          </>
                        ) : (
                          <span>Manual</span>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                      {rec.checkInTime || "-"}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                      {rec.distanceMeter !== null ? `${Math.round(rec.distanceMeter)}m` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
