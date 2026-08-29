"use client";

import { useEffect, useState, use, useRef } from "react";
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
  Camera,
  CameraOff,
  X,
} from "lucide-react";
import { loadFaceApiModels, detectFaceWithDescriptor, captureFrameBase64 } from "@/lib/client-face-api";

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
  faceDescriptor?: string | null;
  facePhoto?: string | null;
  faceRegisteredAt?: string | null;
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
  const [selectedTemplate, setSelectedTemplate] = useState<string>("NAME_CONFIRMATION");
  const [directMsgText, setDirectMsgText] = useState("");
  const [sendingDirectMsg, setSendingDirectMsg] = useState(false);

  // Admin Face Capture Modal State
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [showFacePreviewModal, setShowFacePreviewModal] = useState(false);
  const [faceCamActive, setFaceCamActive] = useState(false);
  const [capturingFace, setCapturingFace] = useState(false);
  const adminVideoRef = useRef<HTMLVideoElement | null>(null);

  const startAdminCamera = async () => {
    try {
      await loadFaceApiModels();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false,
      });
      if (adminVideoRef.current) {
        adminVideoRef.current.srcObject = stream;
        await adminVideoRef.current.play();
        setFaceCamActive(true);
      }
    } catch (e: any) {
      toast.error(`Kamera tidak dapat diakses: ${e.message}`);
    }
  };

  const stopAdminCamera = () => {
    if (adminVideoRef.current && adminVideoRef.current.srcObject) {
      const stream = adminVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      adminVideoRef.current.srcObject = null;
    }
    setFaceCamActive(false);
  };

  const handleCaptureAdminFace = async () => {
    if (!adminVideoRef.current || !participant) return;
    setCapturingFace(true);
    toast.info("Menganalisis wajah peserta...");

    try {
      const detection = await detectFaceWithDescriptor(adminVideoRef.current);
      if (!detection) {
        toast.warning("Wajah peserta tidak terdeteksi! Posisikan wajah di tengah kamera.");
        setCapturingFace(false);
        return;
      }

      const photoBase64 = captureFrameBase64(adminVideoRef.current, detection.box);

      const res = await fetch("/api/admin/face/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: participant.id,
          faceDescriptor: detection.descriptor,
          photoBase64,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Data wajah peserta berhasil disimpan!");
        stopAdminCamera();
        setShowFaceModal(false);
        fetchParticipant();
      } else {
        toast.error(json.error || "Gagal mendaftarkan wajah peserta.");
      }
    } catch (e: any) {
      toast.error(e.message || "Terjadi kesalahan.");
    } finally {
      setCapturingFace(false);
    }
  };

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

  const getTemplateText = (templateKey: string, p: Participant | null) => {
    const studentName = p?.name || "Peserta";
    if (templateKey === "NAME_CONFIRMATION") {
      return `Halo Kak ${studentName}! 👋

Apakah ini merupakan nama lengkap Anda:
👉 *${studentName}*

Kami butuh nama lengkap Anda untuk pendataan dan keperluan nilai.

Silakan balas pesan ini:
👉 Ketik *YA* (jika sudah merupakan nama lengkap yang benar)
👉 Ketik *TIDAK* (jika ingin memperbaiki nama lengkap Anda langsung via WhatsApp)`;
    }

    if (templateKey === "FACE_REMINDER") {
      return `Halo Kak ${studentName}! 👋

Kami melihat kamu masih belum melengkapi pendaftaran wajah (Face ID) untuk keperluan absensi & verifikasi ujian di VeloNet.

❓ Jawab *Y* untuk detail lebih lanjut dan menerima link pendaftaran wajah kamu.`;
    }

    if (templateKey === "PORTAL_LINK") {
      return `Halo Kak ${studentName}! 👋

Berikut adalah akses Portal Siswa VeloNet Anda.
Silakan klik link di bawah ini untuk membuka halaman profil dan materi belajar:
🌐 https://velonet.onrender.com/student/login

_Atau balas *LOGIN* pada chat ini untuk menerima link direct login 1-klik._ 🙏`;
    }

    return "";
  };

  const handleOpenDirectMsgModal = (defaultTemplate = "NAME_CONFIRMATION") => {
    setSelectedTemplate(defaultTemplate);
    setDirectMsgText(getTemplateText(defaultTemplate, participant));
    setShowDirectMsgModal(true);
  };

  const handleSelectTemplate = (templateKey: string) => {
    setSelectedTemplate(templateKey);
    if (templateKey !== "CUSTOM") {
      setDirectMsgText(getTemplateText(templateKey, participant));
    }
  };

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
          templateType: selectedTemplate,
          userId: participant.id,
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
      <div className="py-16 text-center text-slate-500 space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
        <p className="text-sm font-medium">Memuat detail profil peserta...</p>
      </div>
    );
  }

  if (error || !participant) {
    return (
      <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm text-center space-y-4 max-w-lg mx-auto">
        <UserX className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Peserta Tidak Ditemukan</h2>
        <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
        <Link
          href="/admin/participants"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Data Peserta
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 pb-16">
      {/* Back Button Header */}
      <div>
        <Link
          href="/admin/participants"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Data Peserta
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-extrabold text-white text-xl shadow-md shadow-blue-500/20">
              {participant.name ? participant.name.charAt(0).toUpperCase() : "P"}
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {participant.name || "Peserta Anonim"}
                </h1>
                {getStatusBadge(participant.status, participant.isExcluded)}
              </div>
              <p className="text-sm font-mono text-blue-600 font-bold mt-1 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> {formatPhone(participant.phoneNumber)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {participant.facePhoto && (
              <button
                onClick={() => setShowFacePreviewModal(true)}
                className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Camera className="w-3.5 h-3.5 text-purple-600" />
                <span>Lihat Foto Wajah</span>
              </button>
            )}

            <button
              onClick={() => {
                setShowFaceModal(true);
                startAdminCamera();
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600" />
              <span>{participant.faceDescriptor ? "Update Foto Wajah" : "Rekam Wajah"}</span>
            </button>

            <button
              onClick={() => handleOpenDirectMsgModal("NAME_CONFIRMATION")}
              className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              <span>Kirim WA Personal</span>
            </button>

            <button
              onClick={handleToggleExclusion}
              disabled={actionLoading}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                participant.isExcluded
                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
              }`}
            >
              {participant.isExcluded ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pulihkan (Hapus Exclusion)</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  <span>Kecualikan Nomor</span>
                </>
              )}
            </button>

            <button
              onClick={handleDelete}
              disabled={actionLoading}
              className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              title="Hapus Peserta"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* NEW: Student Attendance Performance Overview Card */}
      {stats && (
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600" /> Performa & Rekap Keaktifan Siswa
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">Ringkasan Statistik Kehadiran</h2>
            </div>

            {/* Performance Badge Label */}
            <div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  stats.percentage >= 75
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : stats.percentage >= 50
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
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
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-xs text-slate-500 font-medium">Total Sesi Diikuti</span>
              <div className="text-2xl font-extrabold text-slate-900">{stats.totalSessions}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center">
              <span className="text-xs text-emerald-700 font-medium">Hadir (GPS)</span>
              <div className="text-2xl font-extrabold text-emerald-700">{stats.hadirCount}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-center">
              <span className="text-xs text-amber-700 font-medium">Izin / Sakit</span>
              <div className="text-2xl font-extrabold text-amber-700">{stats.izinCount}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 text-center">
              <span className="text-xs text-rose-700 font-medium">Tidak Hadir (Alpa)</span>
              <div className="text-2xl font-extrabold text-rose-700">{stats.alpaCount}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Persentase Kehadiran Siswa:</span>
              <strong className="text-emerald-700 font-extrabold">{stats.percentage}%</strong>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.percentage >= 75
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                    : stats.percentage >= 50
                    ? "bg-gradient-to-r from-amber-500 to-yellow-500"
                    : "bg-gradient-to-r from-rose-600 to-rose-500"
                }`}
                style={{ width: `${stats.percentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Detailed Attendance History Datatable */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
            Riwayat Absensi Per Sesi Pertemuan
          </h3>
          <span className="text-xs text-slate-500">
            Total {attendanceHistory.length} Sesi Terdaftar
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
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

            <tbody className="divide-y divide-slate-100 text-slate-800">
              {attendanceHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
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
                    <tr key={item.sessionId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3.5">
                        <Link
                          href={`/admin/sessions/${item.sessionId}`}
                          className="font-bold text-slate-900 hover:text-blue-600 transition-colors block"
                        >
                          {item.sessionTitle}
                        </Link>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {dateFormatted}
                        </span>
                      </td>

                      <td className="p-3.5 text-slate-700">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {item.locationName || "Titik Default"}
                        </span>
                      </td>

                      <td className="p-3.5 font-mono text-slate-600">{timeStr}</td>

                      <td className="p-3.5 font-mono text-emerald-700 font-bold">
                        {item.distanceMeter != null ? `${item.distanceMeter}m` : "-"}
                      </td>

                      <td className="p-3.5">
                        {item.status === "HADIR" ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Hadir
                          </span>
                        ) : item.status === "IZIN" || item.status === "SAKIT" ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {item.status}
                          </span>
                        ) : item.status === "ALPA" ? (
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Tidak Hadir (Alpa)
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                            Belum Absen
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-500 max-w-xs truncate" title={item.notes || ""}>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {/* Kelas */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <BookOpen className="w-4 h-4 text-blue-600" /> Kelas / Rombel
          </div>
          <div className="text-xl font-bold text-slate-900">
            {participant.studentClass || <span className="text-slate-400 text-sm font-normal">Belum diisi</span>}
          </div>
        </div>

        {/* Hobi */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <Heart className="w-4 h-4 text-rose-500" /> Hobi & Minat
          </div>
          <div className="text-xl font-bold text-slate-900 truncate">
            {participant.hobby || <span className="text-slate-400 text-sm font-normal">Belum diisi</span>}
          </div>
        </div>

        {/* Tanggal Konfirmasi */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-emerald-600" /> Tanggal Registrasi
          </div>
          <div className="text-sm font-semibold text-slate-800">
            {new Date(participant.createdAt).toLocaleString("id-ID")}
          </div>
        </div>

        {/* Biometrik Wajah Face ID */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider">
              <Camera className="w-4 h-4 text-amber-500" /> Face ID
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              participant.faceDescriptor
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-100 text-slate-500"
            }`}>
              {participant.faceDescriptor ? "Terdaftar" : "Belum"}
            </span>
          </div>

          <div className="flex items-center gap-3 pt-1">
            {participant.facePhoto ? (
              <img
                src={participant.facePhoto}
                alt="Foto Wajah"
                onClick={() => setShowFacePreviewModal(true)}
                className="w-12 h-12 rounded-xl object-cover border border-emerald-400 hover:scale-105 hover:border-purple-500 transition-all cursor-pointer shadow-sm"
                title="Klik untuk melihat foto resolusi penuh"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                <User className="w-5 h-5" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              {participant.facePhoto && (
                <button
                  onClick={() => setShowFacePreviewModal(true)}
                  className="text-xs text-purple-600 hover:text-purple-700 font-semibold text-left hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Camera className="w-3 h-3" />
                  <span>Lihat Foto Wajah</span>
                </button>
              )}
              <button
                onClick={() => {
                  setShowFaceModal(true);
                  startAdminCamera();
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold text-left hover:underline cursor-pointer"
              >
                {participant.faceDescriptor ? "Ubah / Rekam Ulang" : "Rekam Sekarang"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Motivasi & Alasan Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" /> Alasan & Motivasi Bergabung Ekskul
        </h3>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed italic">
          {participant.motivation ? (
            `"${participant.motivation}"`
          ) : (
            <span className="text-slate-400 not-italic">Belum mengisi alasan/motivasi pendaftaran.</span>
          )}
        </div>
      </div>

      {/* Modal: Direct WA Message with Templates */}
      {showDirectMsgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200 shadow-xs">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Kirim Pesan WhatsApp Personal</h3>
                  <p className="text-xs text-slate-500">
                    Ke: <strong className="text-blue-600">{participant.name || "Peserta"} (+{participant.phoneNumber})</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDirectMsgModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold px-2 py-0.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSendDirectMessage} className="space-y-4">
              {/* Template Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Pilih Template Pesan:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectTemplate("NAME_CONFIRMATION")}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                      selectedTemplate === "NAME_CONFIRMATION"
                        ? "bg-blue-50 border-blue-400 text-blue-800 ring-2 ring-blue-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>1. Konfirmasi Nama</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-normal">
                      Interaktif YA / TIDAK (isi ulang via WA)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTemplate("FACE_REMINDER")}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                      selectedTemplate === "FACE_REMINDER"
                        ? "bg-emerald-50 border-emerald-400 text-emerald-800 ring-2 ring-emerald-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      <span>2. Pengingat Face ID</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-normal">
                      2-Langkah: Balas Y &rarr; Kirim link
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTemplate("PORTAL_LINK")}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                      selectedTemplate === "PORTAL_LINK"
                        ? "bg-indigo-50 border-indigo-400 text-indigo-800 ring-2 ring-indigo-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>3. Link Portal Siswa</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-normal">
                      Link akses langsung portal
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTemplate("CUSTOM")}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                      selectedTemplate === "CUSTOM"
                        ? "bg-amber-50 border-amber-400 text-amber-800 ring-2 ring-amber-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                      <span>4. Pesan Bebas / Kustom</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-normal">
                      Tulis pesan mandiri
                    </p>
                  </button>
                </div>
              </div>

              {/* Dynamic Bot Handling Note */}
              {selectedTemplate === "NAME_CONFIRMATION" && (
                <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-900 leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1 text-blue-700">
                    <Sparkles className="w-3.5 h-3.5" /> Bot WhatsApp Otomatis:
                  </p>
                  <p>
                    Jika siswa membalas <strong>YA</strong>, sistem mencatat konfirmasi. Jika membalas <strong>TIDAK</strong>, bot langsung meminta nama baru dan menyimpannya otomatis ke database!
                  </p>
                </div>
              )}

              {selectedTemplate === "FACE_REMINDER" && (
                <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-900 leading-relaxed space-y-1">
                  <p className="font-bold flex items-center gap-1 text-emerald-700">
                    <Camera className="w-3.5 h-3.5" /> Alur 2-Langkah Otomatis:
                  </p>
                  <p>
                    Bot akan menanyakan konfirmasi pendaftaran wajah. Saat siswa membalas <strong>Y</strong>, bot secara otomatis membuat Magic Link 1-Klik dan mengirimkannya langsung ke siswa.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Isi Pesan WhatsApp:
                </label>
                <textarea
                  rows={5}
                  placeholder="Ketik isi pesan WhatsApp..."
                  value={directMsgText}
                  onChange={(e) => setDirectMsgText(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-colors font-mono leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowDirectMsgModal(false)}
                  className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer border border-slate-200"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={sendingDirectMsg || !directMsgText.trim()}
                  className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {sendingDirectMsg ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Kirim Pesan WhatsApp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Face Capture */}
      {showFaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Perekaman Wajah Peserta</h3>
                  <p className="text-xs text-slate-500">{participant.name || participant.phoneNumber}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopAdminCamera();
                  setShowFaceModal(false);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="relative aspect-square max-h-[280px] w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center shadow-inner">
                <video
                  ref={adminVideoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />

                {faceCamActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-40 h-52 rounded-[35px] border-2 border-emerald-400/80 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-pulse" />
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-600 text-center">
                Posisikan wajah siswa di dalam garis panduan, lalu tekan tombol di bawah.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  stopAdminCamera();
                  setShowFaceModal(false);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={handleCaptureAdminFace}
                disabled={capturingFace || !faceCamActive}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {capturingFace ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Menganalisis Wajah...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    <span>Ambil & Simpan Wajah</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN FACE PREVIEW MODAL */}
      {showFacePreviewModal && participant && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-600">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Preview Face ID Biometrik</h3>
                  <p className="text-[11px] text-slate-500">{participant.name || "Peserta"}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowFacePreviewModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-center">
              <div className="relative aspect-square max-h-[300px] w-full rounded-2xl overflow-hidden bg-slate-100 border border-purple-200 flex items-center justify-center shadow-md mx-auto">
                {participant.facePhoto ? (
                  <img
                    src={participant.facePhoto}
                    alt={`Foto Wajah ${participant.name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                    <User className="w-12 h-12 text-slate-400" />
                    <span className="text-xs">Foto biometrik belum tersedia.</span>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-left text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Status Biometrik:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    participant.faceDescriptor
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-slate-200 text-slate-600"
                  }`}>
                    {participant.faceDescriptor ? "Vektor 128-d Terdaftar ✅" : "Belum Direkam ⚠️"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Kelas / Tingkat:</span>
                  <span className="font-bold text-slate-900">{participant.studentClass || "-"}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Nomor WhatsApp:</span>
                  <span className="font-mono text-emerald-700 font-bold">+{participant.phoneNumber}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowFacePreviewModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowFacePreviewModal(false);
                  setShowFaceModal(true);
                  startAdminCamera();
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{participant.faceDescriptor ? "Ubah / Rekam Ulang" : "Rekam Sekarang"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
