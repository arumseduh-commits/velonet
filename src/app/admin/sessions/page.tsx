"use client";

import { useState, useEffect } from "react";
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
  const [locationPreset, setLocationPreset] = useState("Ruang Caprice");
  const [customLocation, setCustomLocation] = useState("");
  const [latitude, setLatitude] = useState("-7.9666");
  const [longitude, setLongitude] = useState("112.6326");
  const [radiusMeter, setRadiusMeter] = useState("15");

  // Location Presets database state
  const [dbPresets, setDbPresets] = useState<
    Array<{ id: string; name: string; latitude: number; longitude: number; radiusMeter: number }>
  >([
    { id: "default-caprice", name: "Ruang Caprice", latitude: -7.9666, longitude: 112.6326, radiusMeter: 15 },
    { id: "default-bi", name: "Ruang BI", latitude: -7.9785, longitude: 112.6315, radiusMeter: 15 },
  ]);
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
          radiusMeter: parseFloat(radiusMeter) || 150,
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
    // Set default date to today YYYY-MM-DD
    const today = new Date().toISOString().split("T")[0];
    setDate(today);

    // Real-time Auto-Sync Poller (Every 3.0s)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchSessions(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Use browser Geolocation to populate lat/long
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Browser Anda tidak mendukung fitur Geolocation GPS.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        toast.success("Lokasi GPS berhasil diambil.");
      },
      (err) => {
        toast.error(`Gagal mengambil lokasi GPS: ${err.message}`);
      },
      { enableHighAccuracy: true }
    );
  };

  // Submit Create Session Form
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !startTime || !endTime) {
      setActionMessage({
        type: "error",
        text: "Judul, tanggal, jam mulai, dan jam selesai wajib diisi.",
      });
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (date < todayStr) {
      setActionMessage({
        type: "error",
        text: "🔴 Tanggal sesi pertemuan tidak boleh sebelum hari ini!",
      });
      return;
    }

    const finalLocationName =
      locationPreset === "Lainnya" ? customLocation.trim() : locationPreset;

    try {
      setIsSubmitting(true);
      setActionMessage(null);
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          date,
          startTime,
          endTime,
          locationName: finalLocationName || "Ruang Caprice",
          latitude,
          longitude,
          radiusMeter,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat sesi");

      setActionMessage({
        type: "success",
        text: "🎉 Sesi Pertemuan Baru berhasil dibuat!",
      });

      // Reset form
      setTitle("");
      setLocationPreset("Ruang Caprice");
      setCustomLocation("");
      setLatitude("");
      setLongitude("");
      setIsModalOpen(false);
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

  // Open Edit & Broadcast WA Modal
  const handleOpenBroadcastModal = (session: SessionItem) => {
    setBroadcastModalSession(session);
    setBroadcastCustomNote(session.customMessage || "");
  };

  // Submit Custom Broadcast WA
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
        text: `📢 Broadcast WA Berhasil! Terkirim ke ${data.successCount} peserta.`,
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

  // Handle Toggle Cancel Session Status
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
          // Ask if Admin wants to broadcast cancellation notice to WA
          const wantBroadcast = await confirm({
            title: "Broadcast WA Pembatalan",
            message: "🔴 Sesi Dibatalkan! Apakah Anda ingin langsung mem-broadcast pesan pembatalan ke WhatsApp peserta?",
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

  // Handle Broadcast WhatsApp (Direct Quick)
  const handleBroadcast = async (sessionId: string) => {
    const s = sessions.find((item) => item.id === sessionId);
    if (s) {
      handleOpenBroadcastModal(s);
    }
  };

  // Handle Toggle Active Status
  const handleToggleActive = async (sessionId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        toast.success(`Status aktif sesi berhasil diubah.`);
        fetchSessions();
      }
    } catch (err) {
      console.error("Failed to toggle session status:", err);
    }
  };

  // Handle Delete Session
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-emerald-900/40 via-slate-900 to-slate-900 border border-emerald-500/20 shadow-xl backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-7 h-7 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Sesi Absensi Pertemuan
            </h1>
          </div>
          <p className="text-slate-400 text-sm">
            Kelola jadwal kumpul sore, titik lokasi GPS, dan broadcast pengumuman otomatis via WhatsApp.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 transition-all duration-200"
        >
          <Plus className="w-5 h-5" />
          <span>Buat Sesi Baru</span>
        </button>
      </div>

      {/* Alert Notification Message */}
      {actionMessage && (
        <div
          className={`flex items-center gap-3 p-4 rounded-xl text-sm font-medium border ${
            actionMessage.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/60 border-rose-500/30 text-rose-300"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Sessions Grid List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-slate-900/50 rounded-2xl border border-slate-800">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-sm text-slate-400">Memuat daftar sesi pertemuan...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center p-12 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 space-y-3">
          <CalendarCheck className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-300">Belum ada Sesi Pertemuan</h3>
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

            const isBroadcastingThis = broadcastingId === session.id;

            const nowTime = new Date();
            const sStart = new Date(session.startTime);
            const sEnd = new Date(session.endTime);

            const todayZero = new Date();
            todayZero.setHours(0, 0, 0, 0);

            const sessionDateZero = new Date(session.date);
            sessionDateZero.setHours(0, 0, 0, 0);

            const isPastDate = sessionDateZero < todayZero;
            const isClosedTime = isPastDate || nowTime > sEnd;
            const isOpenNow = session.isActive && !session.isCancelled && !isPastDate && nowTime >= sStart && nowTime <= sEnd;
            const isUpcoming = session.isActive && !session.isCancelled && !isClosedTime && nowTime < sStart;

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
                className="flex flex-col justify-between p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-emerald-500/40 transition-all duration-200 space-y-4 shadow-lg hover:shadow-emerald-500/5"
              >
                <div>
                  {/* Card Top Header: Title & Dynamic Status Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Link
                      href={`/admin/sessions/${session.id}`}
                      className="group/title flex-1 cursor-pointer"
                    >
                      <h3 className="font-bold text-white text-base group-hover/title:text-emerald-400 transition-colors flex items-center gap-1.5">
                        <span className="hover:underline">{session.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/title:opacity-100 text-emerald-400 transition-opacity" />
                      </h3>
                      <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formattedDate}</span>
                        <span className="font-bold text-amber-400">{relativeDateTag}</span>
                      </p>
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(session.id, session.isActive);
                      }}
                      title="Klik untuk mengubah kunci sakelar Kumpul / Absen (Aktif vs Non-Aktif)"
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-sm hover:scale-105 ${
                        session.isCancelled
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : !session.isActive
                          ? "bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
                          : isOpenNow
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 ring-1 ring-emerald-500/30"
                          : isUpcoming
                          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          session.isCancelled
                            ? "bg-rose-400"
                            : !session.isActive
                            ? "bg-slate-500"
                            : isOpenNow
                            ? "bg-emerald-400 animate-pulse"
                            : isUpcoming
                            ? "bg-blue-400"
                            : "bg-slate-500"
                        }`}
                      />
                      <span>
                        {session.isCancelled
                          ? "Dibatalkan"
                          : !session.isActive
                          ? "Non-Aktif (Kunci)"
                          : isOpenNow
                          ? "Absensi OPEN"
                          : isUpcoming
                          ? "Mendatang"
                          : "Selesai (Tutup)"}
                      </span>
                    </button>
                  </div>

                  {/* Card Body: Info (Clickable Link) */}
                  <Link
                    href={`/admin/sessions/${session.id}`}
                    className="block space-y-2 text-xs text-slate-300 bg-slate-950/40 hover:bg-slate-950/70 p-3 rounded-xl border border-slate-800/50 hover:border-emerald-500/30 transition-all cursor-pointer group/body"
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0 group-hover/body:text-emerald-400 transition-colors" />
                      <span>
                        Jam Absen: <strong className="text-white">{startTimeStr} - {endTimeStr} WIB</strong> <span className="text-slate-500">(Ditutup Otomatis)</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 group-hover/body:text-emerald-400 transition-colors" />
                      <span className="truncate">
                        {session.locationName || "Lokasi Default"} ({session.radiusMeter}m)
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-slate-400">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span>Hadir: <strong className="text-emerald-400 font-bold">{session.hadirCount}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          <span>Izin: <strong className="text-amber-400 font-bold">{session.izinCount}</strong></span>
                        </div>
                      </div>

                      <span className="text-[11px] font-semibold text-emerald-400 group-hover/body:translate-x-0.5 transition-transform flex items-center gap-1">
                        Buka Rekap →
                      </span>
                    </div>
                  </Link>
                </div>

                {/* Card Actions Footer */}
                <div className="space-y-2 pt-2">
                  {!isClosedTime && (
                    <button
                      onClick={() => handleOpenBroadcastModal(session)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-all"
                    >
                      <Send className="w-4 h-4" />
                      <span>📢 Edit & Broadcast WA</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleCancel(session.id, session.isCancelled)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        session.isCancelled
                          ? "bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/30"
                          : "bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border-amber-500/30"
                      }`}
                    >
                      {session.isCancelled ? "Pulihkan Sesi" : "Batalkan Sesi"}
                    </button>

                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      className="p-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition-colors"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
              {/* Modal Header & Progress Indicator */}
              <div className="p-3 px-5 border-b border-slate-800 bg-slate-950/80 shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 font-bold">
                      <CalendarCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white leading-tight">
                        Buat Sesi Pertemuan
                      </h2>
                      <p className="text-[11px] text-slate-400">
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
                    className="text-slate-400 hover:text-white text-xl font-bold px-2 py-0.5 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    &times;
                  </button>
                </div>

                {/* Progress Bar (33% / 66% / 100%) */}
                <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
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
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        1. Pilih Tanggal Pertemuan
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Bulan Sebelumnya"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-semibold text-white px-2 whitespace-nowrap">
                          {monthNames[month]} {year}
                        </span>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
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
                        className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/40 font-medium text-xs transition-all text-center"
                      >
                        Hari Ini
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDateSelect(1)}
                        className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/40 font-medium text-xs transition-all text-center"
                      >
                        Besok
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickDateSelect(7)}
                        className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/40 font-medium text-xs transition-all text-center"
                      >
                        +1 Minggu
                      </button>
                    </div>

                    {/* Days Header */}
                    <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-500 border-b border-slate-800 pb-1">
                      {dayNames.map((d) => (
                        <div key={d}>{d}</div>
                      ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {calendarDays.map((cd, index) => {
                        if (!cd.isCurrentMonth) {
                          return (
                            <div key={index} className="h-8 flex items-center justify-center text-slate-700 opacity-40 text-xs">
                              {cd.day}
                            </div>
                          );
                        }

                        const isSelected = date === cd.dateStr;
                        const todayStr = new Date().toISOString().split("T")[0];
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
                              if (cd.dateStr) {
                                setDate(cd.dateStr);
                                setSelectedDateSessions(dateSessions);
                              }
                            }}
                            className={`h-8 w-full flex items-center justify-center rounded-lg text-xs font-semibold transition-all relative ${
                              isPast
                                ? "opacity-30 text-slate-600 cursor-not-allowed line-through bg-slate-950/40"
                                : isSelected
                                ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/40 ring-2 ring-emerald-400"
                                : isToday
                                ? "bg-slate-800 text-emerald-400 border border-emerald-500/40"
                                : hasSessions
                                ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 hover:bg-slate-800"
                                : "hover:bg-slate-800 text-slate-300"
                            }`}
                          >
                            <span>{cd.day}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Date Summary */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Tanggal Terpilih:</span>
                      <strong className="text-emerald-400 font-bold text-sm">
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
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
                      >
                        Batal
                      </button>

                      <button
                        type="button"
                        disabled={!date}
                        onClick={() => setCreateStep(2)}
                        className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <span>Lanjutkan ➔</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: Detail Pertemuan (Tema & Jam) */}
                {createStep === 2 && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      2. Tema Pertemuan & Jam Absensi
                    </span>

                    <div>
                      <label className="block font-medium text-slate-300 mb-1.5">
                        Judul / Tema Pertemuan <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Pertemuan Sore Velocity #12"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors text-xs font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-medium text-slate-300 mb-1.5">
                          Jam Buka Absen <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 text-xs font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block font-medium text-slate-300 mb-1.5">
                          Jam Selesai / Tutup <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="time"
                          required
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 text-xs font-semibold"
                        />
                      </div>
                    </div>

                    {/* Footer Nav Step 2 */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setCreateStep(1)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors flex items-center gap-1.5"
                      >
                        <span>⬅ Kembali</span>
                      </button>

                      <button
                        type="button"
                        disabled={!title.trim()}
                        onClick={() => setCreateStep(3)}
                        className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <span>Lanjutkan ➔</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: Lokasi, Preset Koordinat & OpenStreetMap Display Card */}
                {createStep === 3 && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      3. Lokasi Perkumpulan & Preview Peta GPS
                    </span>

                    {/* Preset Selection Dropdown */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-medium text-slate-300">
                          Pilih Tempat Perkumpulan Preset <span className="text-rose-400">*</span>
                        </label>
                        <button
                          type="button"
                          disabled={isSavingPreset}
                          onClick={handleSaveNewPreset}
                          className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30 transition-all cursor-pointer"
                        >
                          {isSavingPreset ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          <span>Simpan Sebagai Template Preset</span>
                        </button>
                      </div>

                      <select
                        value={locationPreset}
                        onChange={(e) => handleLocationPresetChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500 transition-colors text-xs font-medium"
                      >
                        {dbPresets.map((preset) => (
                          <option key={preset.id} value={preset.name}>
                            📍 {preset.name} (Preset Saved)
                          </option>
                        ))}
                        <option value="Lainnya">✍️ Lainnya (Ketik Tempat & Koordinat Custom)...</option>
                      </select>

                      {locationPreset === "Lainnya" && (
                        <input
                          type="text"
                          required
                          placeholder="Ketik nama tempat perkumpulan baru (contoh: Ruang 102 / Lab Komputer)"
                          value={customLocation}
                          onChange={(e) => setCustomLocation(e.target.value)}
                          className="w-full mt-2 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors text-xs"
                        />
                      )}
                    </div>

                    {/* GPS Coordinates Inputs */}
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-purple-400 flex items-center gap-1.5">
                          <Navigation className="w-3.5 h-3.5" />
                          Koordinat GPS & Radius Toleransi
                        </span>
                        <button
                          type="button"
                          onClick={handleGetCurrentLocation}
                          className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          Ambil Lokasi GPS Saat Ini
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-400 block mb-0.5">Latitude</span>
                          <input
                            type="number"
                            step="any"
                            placeholder="-7.9666"
                            value={latitude}
                            onChange={(e) => setLatitude(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-[11px] focus:outline-none focus:border-purple-500 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Longitude</span>
                          <input
                            type="number"
                            step="any"
                            placeholder="112.6326"
                            value={longitude}
                            onChange={(e) => setLongitude(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-[11px] focus:outline-none focus:border-purple-500 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Max Radius (m)</span>
                          <input
                            type="number"
                            value={radiusMeter}
                            onChange={(e) => setRadiusMeter(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-[11px] focus:outline-none focus:border-purple-500 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* OpenStreetMap Display Map Card & Fine-Tuning Controls */}
                    {latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude)) && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                            Display Preview Peta Titik Kumpul (OpenStreetMap):
                          </span>

                          {/* Fine-Tuning Nudge Buttons */}
                          <div className="flex items-center gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setLatitude((prev) => (parseFloat(prev) + 0.0001).toFixed(6))}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                              title="Geser Utara (+Lat)"
                            >
                              ⬆ Utara
                            </button>
                            <button
                              type="button"
                              onClick={() => setLatitude((prev) => (parseFloat(prev) - 0.0001).toFixed(6))}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                              title="Geser Selatan (-Lat)"
                            >
                              ⬇ Selatan
                            </button>
                            <button
                              type="button"
                              onClick={() => setLongitude((prev) => (parseFloat(prev) - 0.0001).toFixed(6))}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                              title="Geser Barat (-Lng)"
                            >
                              ⬅ Barat
                            </button>
                            <button
                              type="button"
                              onClick={() => setLongitude((prev) => (parseFloat(prev) + 0.0001).toFixed(6))}
                              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                              title="Geser Timur (+Lng)"
                            >
                              ➔ Timur
                            </button>
                          </div>
                        </div>

                        <div className="rounded-xl overflow-hidden border border-slate-800 h-40 bg-slate-950 relative">
                          <iframe
                            key={`${latitude}-${longitude}`}
                            width="100%"
                            height="100%"
                            frameBorder="0"
                            scrolling="no"
                            marginHeight={0}
                            marginWidth={0}
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                              parseFloat(longitude) - 0.002
                            },${parseFloat(latitude) - 0.002},${
                              parseFloat(longitude) + 0.002
                            },${parseFloat(latitude) + 0.002}&layer=mapnik&marker=${latitude},${longitude}`}
                            className="w-full h-full"
                          />
                        </div>
                      </div>
                    )}

                    {/* Footer Nav Step 3 & Submit Button */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setCreateStep(2)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors flex items-center gap-1.5"
                      >
                        <span>⬅ Kembali</span>
                      </button>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Simpan Sesi Pertemuan</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col space-y-4 p-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">
                    {broadcastModalSession.isCancelled
                      ? "📢 Kirim Broadcast Pembatalan Sesi"
                      : "📢 Edit & Broadcast Undangan WA"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sesi: <strong className="text-emerald-400">{broadcastModalSession.title}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBroadcastModalSession(null)}
                className="text-slate-400 hover:text-white text-xl font-bold px-2 py-0.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSendBroadcastWithCustomMessage} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
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
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Message Live Preview */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Preview Pesan WhatsApp ke Peserta:
                </span>
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 font-mono text-[11px] whitespace-pre-wrap leading-relaxed text-slate-200">
                  {broadcastModalSession.isCancelled ? (
                    `🔴 *PEMBERITAHUAN PEMBATALAN PERTEMUAN VELOCITY*\n\nHalo Kak *[Nama Peserta]*,\n\nMohon maaf, sesi pertemuan *"${broadcastModalSession.title}"* yang dijadwalkan pada *${new Date(broadcastModalSession.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}* di *${broadcastModalSession.locationName || "Titik Kumpul"}* telah *DIBATALKAN* oleh Admin.\n\n${broadcastCustomNote ? `📝 *Alasan/Catatan Admin:*\n${broadcastCustomNote}\n\n` : ''}_Terima kasih dan mohon maaf atas ketidaknyamanannya._`
                  ) : (
                    `📢 *PENGUMUMAN PERTEMUAN VELOCITY*\n\nHalo Kak *[Nama Peserta]*,\n\n📌 *Sesi:* ${broadcastModalSession.title}\n📅 *Hari/Tanggal:* ${new Date(broadcastModalSession.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}\n⏰ *Jam Buka Absen:* ${new Date(broadcastModalSession.startTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB\n⌛ *Jam Ditutup Absen:* ${new Date(broadcastModalSession.endTime).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB (Ditutup Otomatis)\n📍 *Lokasi:* ${broadcastModalSession.locationName || "Lokasi Kumpul Velocity"}\n${broadcastCustomNote ? `\n📝 *Catatan Khusus Admin:*\n${broadcastCustomNote}\n` : ''}\n*Petunjuk Absensi:* Saat berada di lokasi perkumpulan sebelum jam ditutup, cukup kirimkan *Share Location* WhatsApp Anda ke chat bot ini.`
                  )}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setBroadcastModalSession(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={isSendingBroadcast}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSendingBroadcast ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>
                    {isSendingBroadcast ? "Mengirim Broadcast..." : "📢 Kirim Broadcast WhatsApp"}
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
