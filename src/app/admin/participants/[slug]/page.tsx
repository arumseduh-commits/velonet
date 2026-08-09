"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  ArrowLeft,
  User,
  Phone,
  BookOpen,
  Heart,
  Sparkles,
  CheckCircle,
  Clock,
  UserX,
  ShieldAlert,
  RefreshCw,
  UserMinus,
  Trash2,
  Calendar,
  ShieldCheck,
  Send,
  CalendarCheck,
  MapPin,
  MessageSquare,
  Award,
  Loader2,
  TrendingUp,
} from "lucide-react";

interface Participant {
  id: string;
  phoneNumber: string;
  name: string | null;
  studentClass: string | null;
  motivation: string | null;
  hobby: string | null;
  status: string;
  isExcluded: boolean;
  isKickedFromGrp: boolean;
  lastSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AttendanceRecord {
  sessionId: string;
  sessionTitle: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  locationName: string | null;
  isCancelled: boolean;
  status: "HADIR" | "IZIN" | "SAKIT" | "ALPA" | "BELUM_ABSEN";
  checkInTime: string | null;
  distanceMeter: number | null;
  method: string | null;
  notes: string | null;
}

interface StudentStats {
  totalSessions: number;
  hadirCount: number;
  izinCount: number;
  alpaCount: number;
  percentage: number;
}

export default function ParticipantDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { confirm, toast } = useDialog();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<StudentStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Direct WA Message Modal State
  const [showDirectMsgModal, setShowDirectMsgModal] = useState(false);
  const [directMsgText, setDirectMsgText] = useState("");
  const [sendingDirectMsg, setSendingDirectMsg] = useState(false);

  const fetchParticipant = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/participants/${resolvedParams.slug}`);
      const json = await res.json();
      if (json.success) {
        setParticipant(json.data);
        setAttendanceHistory(json.attendanceHistory || []);
        setStats(json.stats || null);
      } else {
        setError(json.error || "Peserta tidak ditemukan.");
      }
    } catch (err: any) {
      setError(err.message || "Gagal memuat data peserta.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipant();
    // Real-time Auto-Sync Poller (Every 3.5s)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchParticipant(true);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [resolvedParams.slug]);

  const handleSendDirectMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participant || !directMsgText.trim()) return;

    try {
      setSendingDirectMsg(true);
      const res = await fetch("/api/bot/send-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: participant.phoneNumber,
          message: directMsgText,
        }),
      });

      let json: any = {};
      try {
        json = await res.json();
      } catch (e) {
        throw new Error("Gagal memproses respon server. Pastikan server aktif.");
      }

      if (res.ok && json.success) {
        toast.success("Pesan WhatsApp berhasil dikirim ke siswa!");
        setShowDirectMsgModal(false);
        setDirectMsgText("");
      } else {
        toast.error(json.error || "Gagal mengirim pesan WhatsApp.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim pesan WhatsApp.");
    } finally {
      setSendingDirectMsg(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!participant) return;
    const confirmed = await confirm({
      title: "Kirim Ulang Konfirmasi DM",
      message: `Kirim ulang pesan konfirmasi DM ke +${participant.phoneNumber} (${participant.name || "Peserta"})?`,
      confirmText: "Ya, Kirim Konfirmasi",
      cancelText: "Batal",
      variant: "info",
      icon: "send",
    });

    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/bot/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_member_confirmation",
          phoneNumber: participant.phoneNumber,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Pesan konfirmasi berhasil dikirim ulang via DM!");
        fetchParticipant();
      } else {
        toast.error(`Gagal: ${json.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleExclusion = async () => {
    if (!participant) return;
    setActionLoading(true);
    try {
      if (participant.isExcluded) {
        await fetch(`/api/exclusions?id=${participant.id}`, { method: "DELETE" });
        toast.success("Pengecualian berhasil dicabut.");
      } else {
        await fetch("/api/exclusions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: participant.phoneNumber,
            name: participant.name,
          }),
        });
        toast.success("Peserta berhasil dikecualikan dari bot.");
      }
      fetchParticipant();
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!participant) return;
    const confirmed = await confirm({
      title: "Hapus Permanen Peserta",
      message: `Apakah Anda yakin ingin menghapus permanen peserta +${participant.phoneNumber}? Data yang telah dihapus tidak dapat dikembalikan.`,
      confirmText: "Ya, Hapus Permanen",
      cancelText: "Batal",
      variant: "danger",
      icon: "trash",
    });

    if (!confirmed) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/participants?id=${participant.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Peserta berhasil dihapus.");
        router.push("/admin/participants");
      } else {
        toast.error(`Gagal: ${json.error}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatPhone = (phone: string) => {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = "62" + cleaned.slice(1);
    return `+${cleaned}`;
  };

  const getStatusBadge = (status: string, isExcluded: boolean) => {
    if (isExcluded) {
      return (
        <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold inline-flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> DIKECUALIKAN
        </span>
      );
    }

    switch (status) {
      case "COMPLETED":
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold inline-flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> TERDAFTAR (Completed)
          </span>
        );
      case "OPTED_OUT":
        return (
          <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold inline-flex items-center gap-1.5">
            <UserX className="w-3.5 h-3.5" /> MENOLAK (Opted Out)
          </span>
        );
      case "WAITING_CONFIRMATION":
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> MENUNGGU KONFIRMASI
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold">
            BELUM DIKONTAK
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400 space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400" />
        <p className="text-sm">Memuat detail profil peserta...</p>
      </div>
    );
  }

  if (error || !participant) {
    return (
      <div className="p-8 rounded-2xl glass-panel border border-slate-800 text-center space-y-4 max-w-lg mx-auto">
        <UserX className="w-12 h-12 text-rose-400 mx-auto" />
        <h2 className="text-lg font-bold text-white">Peserta Tidak Ditemukan</h2>
        <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
        <Link
          href="/admin/participants"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Data Peserta
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button Header */}
      <div>
        <Link
          href="/admin/participants"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Data Peserta
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl glass-panel border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-blue-500/20">
              {participant.name ? participant.name.charAt(0).toUpperCase() : "P"}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  {participant.name || "Peserta Anonim"}
                </h1>
                {getStatusBadge(participant.status, participant.isExcluded)}
              </div>
              <p className="text-sm font-mono text-blue-400 mt-1 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> {formatPhone(participant.phoneNumber)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDirectMsgModal(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
              <span>Kirim WA Personal</span>
            </button>

            <button
              onClick={handleResendConfirmation}
              disabled={actionLoading}
              className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Resend DM</span>
            </button>

            <button
              onClick={handleToggleExclusion}
              disabled={actionLoading}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                participant.isExcluded
                  ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              }`}
            >
              {participant.isExcluded ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Pulihkan (Hapus Exclusion)</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Kecualikan Nomor</span>
                </>
              )}
            </button>

            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="p-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Hapus Peserta"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* NEW: Student Attendance Performance Overview Card */}
      {stats && (
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Award className="w-4 h-4" /> Performa & Rekap Keaktifan Siswa
              </span>
              <h2 className="text-lg font-bold text-white mt-0.5">Ringkasan Statistik Kehadiran</h2>
            </div>

            {/* Performance Badge Label */}
            <div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  stats.percentage >= 75
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : stats.percentage >= 50
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                }`}
              >
                {stats.percentage >= 75
                  ? "🌟 Sangat Rajin & Aktif"
                  : stats.percentage >= 50
                  ? "👍 Cukup Aktif"
                  : "⚠️ Perlu Perhatian (Alpa Tinggi)"}
              </span>
            </div>
          </div>

          {/* 4 Stat Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
              <span className="text-xs text-slate-400 font-medium">Total Sesi Diikuti</span>
              <div className="text-2xl font-extrabold text-white">{stats.totalSessions}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-center">
              <span className="text-xs text-emerald-300 font-medium">Hadir (GPS)</span>
              <div className="text-2xl font-extrabold text-emerald-400">{stats.hadirCount}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/20 text-center">
              <span className="text-xs text-amber-300 font-medium">Izin / Sakit</span>
              <div className="text-2xl font-extrabold text-amber-400">{stats.izinCount}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/20 text-center">
              <span className="text-xs text-rose-300 font-medium">Tidak Hadir (Alpa)</span>
              <div className="text-2xl font-extrabold text-rose-400">{stats.alpaCount}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Persentase Kehadiran Siswa:</span>
              <strong className="text-emerald-400 font-extrabold">{stats.percentage}%</strong>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.percentage >= 75
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                    : stats.percentage >= 50
                    ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                    : "bg-gradient-to-r from-rose-600 to-rose-400"
                }`}
                style={{ width: `${stats.percentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* NEW: Detailed Attendance History Datatable */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
            Riwayat Absensi Per Sesi Pertemuan
          </h3>
          <span className="text-xs text-slate-400">
            Total {attendanceHistory.length} Sesi Terdaftar
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3.5">No</th>
                <th className="p-3.5">Nama Sesi & Tanggal</th>
                <th className="p-3.5">Lokasi Kumpul</th>
                <th className="p-3.5">Jam Absen</th>
                <th className="p-3.5">Jarak GPS</th>
                <th className="p-3.5">Status Kehadiran</th>
                <th className="p-3.5">Catatan</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {attendanceHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Belum ada riwayat sesi pertemuan.
                  </td>
                </tr>
              ) : (
                attendanceHistory.map((item, idx) => {
                  const dateFormatted = new Date(item.sessionDate).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });

                  const timeStr = item.checkInTime
                    ? new Date(item.checkInTime).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-";

                  return (
                    <tr key={item.sessionId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-3.5">
                        <Link
                          href={`/admin/sessions/${item.sessionId}`}
                          className="font-bold text-white hover:text-emerald-400 transition-colors block"
                        >
                          {item.sessionTitle}
                        </Link>
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {dateFormatted}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-300">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {item.locationName || "Titik Default"}
                        </span>
                      </td>

                      <td className="p-3.5 font-mono text-slate-400">{timeStr}</td>

                      <td className="p-3.5 font-mono text-emerald-400 font-semibold">
                        {item.distanceMeter != null ? `${item.distanceMeter}m` : "-"}
                      </td>

                      <td className="p-3.5">
                        {item.status === "HADIR" ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Hadir
                          </span>
                        ) : item.status === "IZIN" || item.status === "SAKIT" ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {item.status}
                          </span>
                        ) : item.status === "ALPA" ? (
                          <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" /> Tidak Hadir (Alpa)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium">
                            Belum Absen
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-400 max-w-xs truncate" title={item.notes || ""}>
                        {item.notes || "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kelas */}
        <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <BookOpen className="w-4 h-4 text-blue-400" /> Kelas / Rombel
          </div>
          <div className="text-xl font-bold text-white">
            {participant.studentClass || <span className="text-slate-500 text-sm font-normal">Belum diisi</span>}
          </div>
        </div>

        {/* Hobi */}
        <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <Heart className="w-4 h-4 text-rose-400" /> Hobi & Minat
          </div>
          <div className="text-xl font-bold text-white">
            {participant.hobby || <span className="text-slate-500 text-sm font-normal">Belum diisi</span>}
          </div>
        </div>

        {/* Tanggal Konfirmasi */}
        <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-emerald-400" /> Tanggal Registrasi
          </div>
          <div className="text-sm font-medium text-slate-200">
            {new Date(participant.createdAt).toLocaleString("id-ID")}
          </div>
        </div>
      </div>

      {/* Motivasi & Alasan Card */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" /> Alasan & Motivasi Bergabung Ekskul
        </h3>

        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-sm text-slate-200 leading-relaxed italic">
          {participant.motivation ? (
            `"${participant.motivation}"`
          ) : (
            <span className="text-slate-500 not-italic">Belum mengisi alasan/motivasi pendaftaran.</span>
          )}
        </div>
      </div>

      {/* Modal: Direct WA Message */}
      {showDirectMsgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col space-y-4 p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Kirim Pesan WA Personal</h3>
                  <p className="text-xs text-slate-400">
                    Ke: <strong className="text-blue-400">{participant.name || "Peserta"} (+{participant.phoneNumber})</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDirectMsgModal(false)}
                className="text-slate-400 hover:text-white text-xl font-bold px-2 py-0.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSendDirectMessage} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Isi Pesan WhatsApp Personal:
                </label>
                <textarea
                  rows={4}
                  placeholder="Ketik pesan yang ingin dikirimkan ke siswa ini via WhatsApp..."
                  value={directMsgText}
                  onChange={(e) => setDirectMsgText(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDirectMsgModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={sendingDirectMsg}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {sendingDirectMsg ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Kirim Pesan WA</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
