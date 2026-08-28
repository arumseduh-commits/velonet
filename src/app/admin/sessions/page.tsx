"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  CalendarCheck,
  Plus,
  Radio,
  MapPin,
  Clock,
  Users,
  Send,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Navigation,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";

const InteractiveLocationPicker = dynamic(
  () => import("@/components/ui/InteractiveLocationPicker"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-2">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Memuat Peta Interaktif...</span>
      </div>
    ),
  }
);

interface SessionItem {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusMeter: number;
  isActive: boolean;
  isCancelled: boolean;
  customMessage: string | null;
  hadirCount: number;
  izinCount: number;
  createdAt: string;
}

export default function SessionsAdminPage() {
  const { confirm, toast } = useDialog();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Edit & Broadcast WA Modal State
  const [broadcastModalSession, setBroadcastModalSession] = useState<SessionItem | null>(null);
  const [broadcastCustomNote, setBroadcastCustomNote] = useState("");
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  // Step-by-Step Wizard Form State for Mobile
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("15:30");
  const [endTime, setEndTime] = useState("17:30");
  const [locationPreset, setLocationPreset] = useState("Lainnya");
  const [customLocation, setCustomLocation] = useState("Kota Probolinggo");
  const [latitude, setLatitude] = useState("-7.7543");
  const [longitude, setLongitude] = useState("113.2159");
  const [radiusMeter, setRadiusMeter] = useState("50");
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

  // Location Presets database state
  const [dbPresets, setDbPresets] = useState<
    Array<{ id: string; name: string; latitude: number; longitude: number; radiusMeter: number }>
  >([]);
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  const fetchLocationPresets = async () => {
    try {
      const res = await fetch("/api/location-presets");
      const json = await res.json();
      if (json.success && json.data) {
        setDbPresets(json.data);
      }
    } catch (err) {
      console.error("Gagal mengambil preset lokasi:", err);
    }
  };

  useEffect(() => {
    fetchLocationPresets();
  }, []);

  const handleLocationPresetChange = (presetName: string) => {
    setLocationPreset(presetName);
    const found = dbPresets.find((p) => p.name === presetName);
    if (found) {
      setCustomLocation("");
      setLatitude(found.latitude.toString());
      setLongitude(found.longitude.toString());
      setRadiusMeter(found.radiusMeter.toString());
    } else if (presetName === "Lainnya") {
      setCustomLocation("");
    }
  };

  const handleSaveNewPreset = async () => {
    const targetName = locationPreset === "Lainnya" ? customLocation.trim() : locationPreset.trim();
    if (!targetName) {
      toast.error("Silakan ketik Nama Tempat terlebih dahulu!");
      return;
    }
    if (!latitude || !longitude || isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
      toast.error("Koordinat GPS (Latitude & Longitude) wajib diisi dengan benar!");
      return;
    }

    try {
      setIsSavingPreset(true);
      const res = await fetch("/api/location-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: targetName,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          radiusMeter: parseFloat(radiusMeter) || 50,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Template tempat "${targetName}" berhasil disimpan!`);
        await fetchLocationPresets();
        setLocationPreset(targetName);
      } else {
        toast.error(json.error || "Gagal menyimpan template lokasi.");
      }
    } catch (err: any) {
      toast.error("Gagal terhubung ke server.");
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleDeletePreset = async (presetId: string, presetName: string) => {
    const confirmed = await confirm({
      title: "Hapus Template Lokasi",
      message: `Apakah Anda yakin ingin menghapus template lokasi "${presetName}"?`,
      confirmText: "Ya, Hapus",
      cancelText: "Batal",
      variant: "danger",
      icon: "trash",
    });
    if (!confirmed) return;

    try {
      setDeletingPresetId(presetId);
      const res = await fetch(`/api/location-presets?id=${presetId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Template lokasi "${presetName}" berhasil dihapus.`);
        await fetchLocationPresets();
        if (locationPreset === presetName) {
          setLocationPreset("Lainnya");
          setCustomLocation("");
        }
      } else {
        toast.error(json.error || "Gagal menghapus template lokasi.");
      }
    } catch (err) {
      toast.error("Gagal terhubung ke server.");
    } finally {
      setDeletingPresetId(null);
    }
  };

  // Quick Time Preset Selector
  const handleSetQuickTime = (type: "NOW" | "MORNING" | "AFTERNOON" | "EVENING" | "NIGHT") => {
    const now = new Date();
    if (type === "NOW") {
      const startD = new Date(now.getTime() - 5 * 60 * 1000); // 5 mins ago
      const endD = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
      const sH = String(startD.getHours()).padStart(2, "0");
      const sM = String(startD.getMinutes()).padStart(2, "0");
      const eH = String(endD.getHours()).padStart(2, "0");
      const eM = String(endD.getMinutes()).padStart(2, "0");
      setStartTime(`${sH}:${sM}`);
      setEndTime(`${eH}:${eM}`);
      const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      setDate(todayLocal);
    } else if (type === "MORNING") {
      setStartTime("08:00");
      setEndTime("10:00");
    } else if (type === "AFTERNOON") {
      setStartTime("13:00");
      setEndTime("15:00");
    } else if (type === "EVENING") {
      setStartTime("15:30");
      setEndTime("17:30");
    } else if (type === "NIGHT") {
      setStartTime("19:30");
      setEndTime("21:30");
    }
  };

  const formatFriendlyTime = (t: string) => {
    if (!t) return "";
    const [hStr, mStr] = t.split(":");
    const h = parseInt(hStr, 10);
    const m = mStr || "00";
    if (isNaN(h)) return t;

    let period = "";
    if (h >= 0 && h < 5) period = "Dini Hari";
    else if (h >= 5 && h < 11) period = "Pagi";
    else if (h >= 11 && h < 15) period = "Siang";
    else if (h >= 15 && h < 18) period = "Sore";
    else period = "Malam";

    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h < 12 ? "AM" : "PM";
    return `${t} WIB (${hour12}:${m} ${ampm} • ${period})`;
  };

  // Calendar View State
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDateSessions, setSelectedDateSessions] = useState<SessionItem[]>([]);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleQuickDateSelect = (daysFromToday: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const formatted = `${year}-${month}-${day}`;
    setDate(formatted);
    setViewDate(d);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Fetch all sessions
  const fetchSessions = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const nowLocal = new Date();
    const today = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
    setDate(today);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchSessions(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Browser Anda tidak mendukung fitur Geolocation GPS.");
      return;
    }
    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setIsLocatingGps(false);
        toast.success("Lokasi GPS berhasil diambil.");
      },
      (err) => {
        setIsLocatingGps(false);
        toast.error(`Gagal mengambil lokasi GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !startTime || !endTime) {
      setActionMessage({
        type: "error",
        text: "Judul, tanggal, jam mulai, dan jam selesai wajib diisi.",
      });
      return;
    }

    const nowLocal = new Date();
    const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
    if (date < todayStr) {
      setActionMessage({
        type: "error",
        text: "Tanggal sesi pertemuan tidak boleh sebelum hari ini!",
      });
      return;
    }

    const finalLocationName =
      locationPreset === "Lainnya" ? customLocation.trim() : locationPreset;

    try {
      setIsSubmitting(true);
      setActionMessage(null);

      const [year, month, day] = date.split("-").map(Number);
      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);

      const startDateObj = new Date(year, month - 1, day, startH, startM, 0);
      let endDateObj = new Date(year, month - 1, day, endH, endM, 0);

      if (endDateObj <= startDateObj) {
        endDateObj.setDate(endDateObj.getDate() + 1);
      }

      const dateIso = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString();
      const startIso = startDateObj.toISOString();
      const endIso = endDateObj.toISOString();

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          date,
          startTime,
          endTime,
          startIso,
          endIso,
          dateIso,
          locationName: finalLocationName || "Lokasi Pertemuan",
          latitude,
          longitude,
          radiusMeter,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat sesi");

      setActionMessage({
        type: "success",
        text: "Sesi Pertemuan Baru berhasil dibuat!",
      });

      setTitle("");
      setLocationPreset("Lainnya");
      setCustomLocation("");
      setLatitude("");
      setLongitude("");
      setIsModalOpen(false);
      setCreateStep(1);
      fetchSessions();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Terjadi kesalahan saat membuat sesi",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenBroadcastModal = (session: SessionItem) => {
    setBroadcastModalSession(session);
    setBroadcastCustomNote(session.customMessage || "");
  };

  const handleSendBroadcastWithCustomMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastModalSession) return;

    try {
      setIsSendingBroadcast(true);
      setActionMessage(null);
      const res = await fetch(`/api/sessions/${broadcastModalSession.id}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customMessage: broadcastCustomNote,
          isCancellationNotice: broadcastModalSession.isCancelled,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mem-broadcast pengumuman");

      setActionMessage({
        type: "success",
        text: `Broadcast WA Berhasil! Terkirim ke ${data.successCount} peserta.`,
      });
      setBroadcastModalSession(null);
      fetchSessions();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Gagal mem-broadcast pengumuman",
      });
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleToggleCancel = async (sessionId: string, currentCancelled: boolean) => {
    const actionName = currentCancelled ? "MEMULIHKAN kembali" : "MEMBATALKAN";
    const confirmed = await confirm({
      title: `${currentCancelled ? "Pulihkan" : "Batalkan"} Sesi Pertemuan`,
      message: `Apakah Anda yakin ingin ${actionName} sesi pertemuan ini?`,
      confirmText: currentCancelled ? "Ya, Pulihkan Sesi" : "Ya, Batalkan Sesi",
      cancelText: "Batal",
      variant: currentCancelled ? "info" : "danger",
      icon: currentCancelled ? "info" : "warning",
    });

    if (!confirmed) {
      return;
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCancelled: !currentCancelled }),
      });
      if (res.ok) {
        toast.success(`Sesi berhasil ${currentCancelled ? "dipulihkan" : "dibatalkan"}.`);
        const target = sessions.find((s) => s.id === sessionId);
        if (!currentCancelled && target) {
          const wantBroadcast = await confirm({
            title: "Broadcast WA Pembatalan",
            message: "Sesi Dibatalkan! Apakah Anda ingin langsung mem-broadcast pesan pembatalan ke WhatsApp peserta?",
            confirmText: "Ya, Broadcast WA",
            cancelText: "Tidak Perlu",
            variant: "warning",
            icon: "send",
          });

          if (wantBroadcast) {
            setBroadcastModalSession({ ...target, isCancelled: true });
            setBroadcastCustomNote(target.customMessage || "Perkumpulan sore ini DIBATALKAN.");
            fetchSessions();
            return;
          }
        }
        fetchSessions();
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah status sesi.");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const confirmed = await confirm({
      title: "Hapus Sesi Pertemuan",
      message: "Apakah Anda yakin ingin menghapus sesi ini beserta seluruh data rekap kehitungannya?",
      confirmText: "Ya, Hapus Sesi",
      cancelText: "Batal",
      variant: "danger",
      icon: "trash",
    });

    if (!confirmed) {
      return;
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Sesi pertemuan berhasil dihapus.");
        fetchSessions();
      } else {
        toast.error("Gagal menghapus sesi.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus sesi.");
    }
  };

  const handleToggleActive = async (sessionId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        toast.success("Status aktif sesi berhasil diubah.");
        fetchSessions();
      }
    } catch (err) {
      console.error("Failed to toggle session status:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-white border border-emerald-200/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Sesi Absensi Pertemuan
            </h1>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm">
            Kelola jadwal kumpul sore, titik koordinat GPS & geofence, dan broadcast pengumuman via WhatsApp.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/25 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Sesi Baru</span>
        </button>
      </div>

      {/* Alert Notification Message */}
      {actionMessage && (
        <div
          className={`flex items-center gap-3 p-4 rounded-2xl text-xs sm:text-sm font-semibold border ${
            actionMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Sessions Grid List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-xs sm:text-sm text-slate-600 font-medium">Memuat daftar sesi pertemuan...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Belum ada Sesi Pertemuan</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Klik tombol "Buat Sesi Baru" di atas untuk menjadwalkan kumpul sore dan membuka absensi WhatsApp.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sessions.map((session) => {
            const formattedDate = new Date(session.date).toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "short",
              year: "numeric",
            });

            const startTimeStr = new Date(session.startTime).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const endTimeStr = new Date(session.endTime).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            });

            const nowTime = new Date();
            const sStart = new Date(session.startTime);
            const sEnd = new Date(session.endTime);

            const isClosedTime = nowTime > sEnd;
            const isOpenNow = session.isActive && !session.isCancelled && nowTime >= sStart && nowTime <= sEnd;
            const isUpcoming = session.isActive && !session.isCancelled && nowTime < sStart;

            const todayZero = new Date();
            todayZero.setHours(0, 0, 0, 0);

            const sessionDateZero = new Date(sStart);
            sessionDateZero.setHours(0, 0, 0, 0);

            const diffDays = Math.round((sessionDateZero.getTime() - todayZero.getTime()) / (1000 * 3600 * 24));
            let relativeDateTag = "";
            if (diffDays === 0) relativeDateTag = " • Hari Ini";
            else if (diffDays === 1) relativeDateTag = " • Besok";
            else if (diffDays === -1) relativeDateTag = " • Kemarin";
            else if (diffDays > 1) relativeDateTag = ` • ${diffDays} hari lagi`;
            else if (diffDays < -1) relativeDateTag = ` • ${Math.abs(diffDays)} hari lalu`;

            return (
              <div
                key={session.id}
                className="flex flex-col justify-between p-5 rounded-3xl bg-white border border-slate-200 hover:border-emerald-400 shadow-sm hover:shadow-md transition-all duration-200 space-y-4"
              >
                <div>
                  {/* Card Top Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Link
                      href={`/admin/sessions/${session.id}`}
                      className="group/title flex-1 cursor-pointer"
                    >
                      <h3 className="font-bold text-slate-900 text-base group-hover/title:text-emerald-700 transition-colors flex items-center gap-1.5">
                        <span className="hover:underline">{session.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/title:opacity-100 text-emerald-600 transition-opacity" />
                      </h3>
                      <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5 mt-1">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{formattedDate}</span>
                        <span className="font-bold text-amber-700">{relativeDateTag}</span>
                      </p>
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(session.id, session.isActive);
                      }}
                      title="Klik untuk mengubah kunci sakelar Kumpul / Absen (Aktif vs Non-Aktif)"
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-sm ${
                        session.isCancelled
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : !session.isActive
                          ? "bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200"
                          : isOpenNow
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-300 ring-1 ring-emerald-400/40"
                          : isUpcoming
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          session.isCancelled
                            ? "bg-rose-500"
                            : !session.isActive
                            ? "bg-slate-400"
                            : isOpenNow
                            ? "bg-emerald-500 animate-pulse"
                            : isUpcoming
                            ? "bg-blue-500"
                            : "bg-slate-400"
                        }`}
                      />
                      <span>
                        {session.isCancelled
                          ? "Dibatalkan"
                          : !session.isActive
                          ? "Non-Aktif"
                          : isOpenNow
                          ? "Absensi OPEN"
                          : isUpcoming
                          ? "Mendatang"
                          : "Selesai (Tutup)"}
                      </span>
                    </button>
                  </div>

                  {/* Card Body: Info Box */}
                  <Link
                    href={`/admin/sessions/${session.id}`}
                    className="block space-y-2 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100/90 p-3.5 rounded-2xl border border-slate-200/80 transition-all cursor-pointer group/body"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500 shrink-0 group-hover/body:text-emerald-600 transition-colors" />
                      <span>
                        Jam Absen: <strong className="text-slate-900 font-bold">{startTimeStr} - {endTimeStr} WIB</strong> <span className="text-slate-500">(Tutup Otomatis)</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-500 shrink-0 group-hover/body:text-emerald-600 transition-colors" />
                      <span className="truncate font-medium text-slate-800">
                        {session.locationName || "Lokasi Default"} ({session.radiusMeter}m)
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-slate-600">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Hadir: <strong className="text-emerald-700 font-bold">{session.hadirCount}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Izin: <strong className="text-amber-700 font-bold">{session.izinCount}</strong></span>
                        </div>
                      </div>

                      <span className="text-[11px] font-bold text-emerald-700 group-hover/body:translate-x-0.5 transition-transform flex items-center gap-1">
                        Buka Rekap →
                      </span>
                    </div>
                  </Link>
                </div>

                {/* Card Actions Footer */}
                <div className="space-y-2 pt-1">
                  {!isClosedTime && (
                    <button
                      onClick={() => handleOpenBroadcastModal(session)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5 text-blue-600" />
                      <span>Edit & Broadcast WA</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleCancel(session.id, session.isCancelled)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        session.isCancelled
                          ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200"
                      }`}
                    >
                      {session.isCancelled ? "Pulihkan Sesi" : "Batalkan Sesi"}
                    </button>

                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                      title="Hapus Sesi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form: Buat Sesi Baru */}
      {isModalOpen && (() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();

        const monthNames = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];

        const dayNames = ["Ming", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

        const firstDayIndex = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();

        const calendarDays: Array<{ day: number; isCurrentMonth: boolean; dateStr: string | null }> = [];

        for (let i = firstDayIndex - 1; i >= 0; i--) {
          calendarDays.push({
            day: prevMonthDays - i,
            isCurrentMonth: false,
            dateStr: null,
          });
        }

        for (let d = 1; d <= daysInMonth; d++) {
          const mStr = String(month + 1).padStart(2, "0");
          const dStr = String(d).padStart(2, "0");
          const dateStr = `${year}-${mStr}-${dStr}`;
          calendarDays.push({
            day: d,
            isCurrentMonth: true,
            dateStr,
          });
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-900">
              {/* Modal Header & Progress Indicator */}
              <div className="p-4 px-5 border-b border-slate-200 bg-slate-50/80 shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 font-bold">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 leading-tight">
                        Buat Sesi Pertemuan
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        {createStep === 1
                          ? "Langkah 1 dari 3: Pilih Tanggal Pertemuan"
                          : createStep === 2
                          ? "Langkah 2 dari 3: Tema Pertemuan & Jam Absen"
                          : "Langkah 3 dari 3: Lokasi & Display Peta GPS"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setCreateStep(1);
                    }}
                    className="text-slate-400 hover:text-slate-700 text-xl font-bold px-2 py-0.5 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    &times;
                  </button>
                </div>

                {/* Progress Bar (33% / 66% / 100%) */}
                <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                    style={{
                      width: createStep === 1 ? "33%" : createStep === 2 ? "66%" : "100%",
                    }}
                  />
                </div>
              </div>

              {/* Modal Form Body: Step-by-Step Content */}
              <form onSubmit={handleCreateSession} className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* STEP 1: Pilih Tanggal Sesi */}
                {createStep === 1 && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        1. Pilih Tanggal Pertemuan
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="Bulan Sebelumnya"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold text-slate-800 px-2 whitespace-nowrap">
                          {monthNames[month]} {year}
                        </span>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="Bulan Berikutnya"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      <button
                        type="button"
                        onClick={() => handleQuickDateSelect(0)}
                        className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 font-semibold text-xs transition-all text-center cursor-pointer"
                      >
                        Hari Ini
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDateSelect(1)}
                        className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 font-semibold text-xs transition-all text-center cursor-pointer"
                      >
                        Besok
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDateSelect(7)}
                        className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 font-semibold text-xs transition-all text-center cursor-pointer"
                      >
                        +1 Minggu
                      </button>
                    </div>

                    {/* Days Header */}
                    <div className="grid grid-cols-7 text-center text-[11px] font-bold text-slate-500 border-b border-slate-200 pb-1">
                      {dayNames.map((d) => (
                        <div key={d}>{d}</div>
                      ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {calendarDays.map((cd, index) => {
                        if (!cd.isCurrentMonth) {
                          return (
                            <div key={index} className="h-8 flex items-center justify-center text-slate-300 text-xs">
                              {cd.day}
                            </div>
                          );
                        }

                        const isSelected = date === cd.dateStr;
                        const nowLocal = new Date();
                        const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
                        const isToday = todayStr === cd.dateStr;
                        const isPast = Boolean(cd.dateStr && cd.dateStr < todayStr);

                        const dateSessions = sessions.filter((s) => {
                          const sDate = new Date(s.date).toISOString().split("T")[0];
                          return sDate === cd.dateStr;
                        });
                        const hasSessions = dateSessions.length > 0;

                        return (
                          <button
                            type="button"
                            key={index}
                            disabled={isPast}
                            onClick={() => {
                              if (cd.dateStr && !isPast) {
                                setDate(cd.dateStr);
                                setSelectedDateSessions(dateSessions);
                              }
                            }}
                            className={`h-8 w-full flex items-center justify-center rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
                              isPast
                                ? "opacity-30 text-slate-400 line-through bg-slate-50 cursor-not-allowed pointer-events-none"
                                : isSelected
                                ? "bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500"
                                : isToday
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold"
                                : hasSessions
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                : "hover:bg-slate-100 text-slate-700"
                            }`}
                          >
                            <span>{cd.day}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Date Summary */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between text-slate-700">
                      <span className="text-slate-500">Tanggal Terpilih:</span>
                      <strong className="text-emerald-700 font-bold text-sm">
                        {date
                          ? new Date(date).toLocaleDateString("id-ID", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "Silakan pilih tanggal di atas"}
                      </strong>
                    </div>

                    {/* Footer Nav Step 1 */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Batal
                      </button>

                      <button
                        type="button"
                        disabled={!date}
                        onClick={() => setCreateStep(2)}
                        className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Lanjutkan ➔</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: Detail Pertemuan (Tema & Jam) */}
                {createStep === 2 && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600" />
                      2. Tema Pertemuan & Jam Absensi
                    </span>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1.5">
                        Judul / Tema Pertemuan <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Pertemuan Sore Velocity #12"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-colors text-xs font-medium"
                      />
                    </div>

                    {/* Quick Time Preset Buttons */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-600 block">
                        Pilihan Jam Cepat (Klik untuk Pasang):
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleSetQuickTime("NOW")}
                          className="py-1.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Mulai Sekarang (Testing)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetQuickTime("EVENING")}
                          className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 font-medium transition-all text-center cursor-pointer"
                        >
                          Sore (15:30 - 17:30)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetQuickTime("NIGHT")}
                          className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 font-medium transition-all text-center cursor-pointer"
                        >
                          Malam (19:30 - 21:30)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetQuickTime("AFTERNOON")}
                          className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 font-medium transition-all text-center cursor-pointer"
                        >
                          Siang (13:00 - 15:00)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetQuickTime("MORNING")}
                          className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 font-medium transition-all text-center cursor-pointer"
                        >
                          Pagi (08:00 - 10:00)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          Jam Buka Absen <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          Jam Selesai / Tutup <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 text-xs font-semibold"
                        />
                      </div>
                    </div>

                    {/* Friendly Time Format Preview */}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] space-y-1 text-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Jam Buka:</span>
                        <strong className="text-emerald-700 font-mono font-bold">
                          {formatFriendlyTime(startTime)}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Jam Tutup:</span>
                        <strong className="text-amber-700 font-mono font-bold">
                          {formatFriendlyTime(endTime)}
                        </strong>
                      </div>
                    </div>

                    {/* Footer Nav Step 2 */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setCreateStep(1)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>⬅ Kembali</span>
                      </button>

                      <button
                        type="button"
                        disabled={!title.trim()}
                        onClick={() => setCreateStep(3)}
                        className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Lanjutkan ➔</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Lokasi, Preset Koordinat & Peta */}
                {createStep === 3 && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      3. Lokasi Perkumpulan & Peta Titik Kumpul
                    </span>

                    {/* Preset Selection Dropdown & Template Name */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-800 text-xs">
                          Template Tempat Tersimpan:
                        </label>
                        <button
                          type="button"
                          disabled={isSavingPreset}
                          onClick={handleSaveNewPreset}
                          className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-300 transition-all cursor-pointer"
                        >
                          {isSavingPreset ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          <span>Simpan Titik Jadi Template</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={locationPreset}
                          onChange={(e) => handleLocationPresetChange(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-500 transition-colors text-xs font-medium cursor-pointer"
                        >
                          <option value="Lainnya">✍️ Lokasi Baru / Custom (Pilih di Peta)...</option>
                          {dbPresets.map((preset) => (
                            <option key={preset.id} value={preset.name}>
                              📍 {preset.name} (Tersimpan)
                            </option>
                          ))}
                        </select>

                        {locationPreset !== "Lainnya" && (
                          <button
                            type="button"
                            onClick={() => {
                              const found = dbPresets.find((p) => p.name === locationPreset);
                              if (found) handleDeletePreset(found.id, found.name);
                            }}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors shrink-0 cursor-pointer"
                            title="Hapus Template Lokasi Ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Nama Tempat / Gedung / Ruangan <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: Markas VeloNet Probolinggo / Alun-Alun / Cafe Kopi"
                          value={locationPreset === "Lainnya" ? customLocation : locationPreset}
                          onChange={(e) => {
                            if (locationPreset === "Lainnya") {
                              setCustomLocation(e.target.value);
                            } else {
                              setLocationPreset(e.target.value);
                            }
                          }}
                          className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors text-xs font-medium"
                        />
                      </div>
                    </div>

                    {/* Interactive Leaflet Map Location Picker */}
                    <InteractiveLocationPicker
                      latitude={latitude}
                      longitude={longitude}
                      radiusMeter={radiusMeter}
                      locationName={locationPreset === "Lainnya" ? customLocation : locationPreset}
                      onLocationChange={(newLat, newLng, newName) => {
                        setLatitude(newLat);
                        setLongitude(newLng);
                        if (newName && (locationPreset === "Lainnya" || !customLocation)) {
                          setCustomLocation(newName);
                        }
                      }}
                      onRadiusChange={(newRadius) => setRadiusMeter(newRadius)}
                      onLocationNameChange={(newName) => {
                        if (locationPreset === "Lainnya") {
                          setCustomLocation(newName);
                        }
                      }}
                    />

                    {/* Footer Nav Step 3 & Submit Button */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setCreateStep(2)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>⬅ Kembali</span>
                      </button>

                      <button
                        type="submit"
                        disabled={isSubmitting || !latitude || !longitude}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Menyimpan Sesi...</span>
                          </>
                        ) : (
                          <span>Simpan Sesi Pertemuan</span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal: Edit & Broadcast WA Message */}
      {broadcastModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col space-y-4 p-5 sm:p-6 text-slate-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-200">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {broadcastModalSession.isCancelled
                      ? "Kirim Broadcast Pembatalan Sesi"
                      : "Edit & Broadcast Undangan WA"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sesi: <strong className="text-emerald-700 font-bold">{broadcastModalSession.title}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBroadcastModalSession(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold px-2 py-0.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSendBroadcastWithCustomMessage} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {broadcastModalSession.isCancelled
                    ? "Alasan / Catatan Pembatalan (Bisa Diedit):"
                    : "Catatan Tambahan / Pesan Khusus Admin (Bisa Diedit):"}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    broadcastModalSession.isCancelled
                      ? "Contoh: Mohon maaf, perkumpulan sore ditiadakan karena ada keperluan mendadak."
                      : "Contoh: Harap membawa laptop masing-masing dan memakai dresscode kaos hitam."
                  }
                  value={broadcastCustomNote}
                  onChange={(e) => setBroadcastCustomNote(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-colors"
                />
              </div>

              {/* Message Live Preview */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Preview Pesan WhatsApp ke Peserta:
                </span>
                <div className="p-3 rounded-xl bg-white border border-emerald-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed text-slate-800 shadow-sm">
                  {broadcastModalSession.isCancelled ? (
                    `🔴 *PEMBERITAHUAN PEMBATALAN PERTEMUAN VELOCITY*\n\nHalo Kak *[Nama Peserta]*,\n\nMohon maaf, sesi pertemuan *"${broadcastModalSession.title}"* yang dijadwalkan pada *${new Date(broadcastModalSession.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}* di *${broadcastModalSession.locationName || "Titik Kumpul"}* telah *DIBATALKAN* oleh Admin.\n\n${broadcastCustomNote ? `📝 *Alasan/Catatan Admin:*\n${broadcastCustomNote}\n\n` : ''}_Terima kasih dan mohon maaf atas ketidaknyamanannya._`
                  ) : (
                    `📢 *PENGUMUMAN PERTEMUAN VELOCITY*\n\nHalo Kak *[Nama Peserta]*,\n\n📌 *Sesi:* ${broadcastModalSession.title}\n📅 *Hari/Tanggal:* ${new Date(broadcastModalSession.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}\n⏰ *Jam Buka Absen:* ${new Date(broadcastModalSession.startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB\n⌛ *Jam Ditutup Absen:* ${new Date(broadcastModalSession.endTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB (Ditutup Otomatis)\n📍 *Lokasi:* ${broadcastModalSession.locationName || "Lokasi Kumpul Velocity"}\n${broadcastCustomNote ? `\n📝 *Catatan Khusus Admin:*\n${broadcastCustomNote}\n` : ''}\n*Petunjuk Absensi:* Saat berada di lokasi perkumpulan sebelum jam ditutup, cukup kirimkan *Share Location* WhatsApp Anda ke chat bot ini.`
                  )}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setBroadcastModalSession(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSendingBroadcast}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSendingBroadcast ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>
                    {isSendingBroadcast ? "Mengirim Broadcast..." : "Kirim Broadcast WhatsApp"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

