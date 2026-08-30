"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useDialog } from "@/components/ui/DialogProvider";
import Pagination from "@/components/ui/Pagination";
import {
  ArrowLeft,
  CalendarCheck,
  Download,
  Send,
  Users,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  AlertCircle,
  Loader2,
  Filter,
  UserCheck,
  UserX,
  FileSpreadsheet,
  Navigation,
} from "lucide-react";

interface ParticipantAttendanceItem {
  participantId: string;
  name: string;
  phoneNumber: string;
  studentClass: string;
  registrationStatus: string;
  attendanceId: string | null;
  status: "HADIR" | "IZIN" | "SAKIT" | "ALPA" | "BELUM_ABSEN";
  method: string | null;
  checkInTime: string | null;
  distanceMeter: number | null;
  notes: string | null;
}

interface SessionData {
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
}

export default function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const { confirm, toast } = useDialog();

  const [session, setSession] = useState<SessionData | null>(null);
  const [participants, setParticipants] = useState<ParticipantAttendanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "ALL">(10);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isFollowingUpAlpa, setIsFollowingUpAlpa] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchDetail = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setParticipants(data.participants);
      }
    } catch (err) {
      console.error("Failed to fetch session detail:", err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchDetail(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionId]);

  // Handle Manual Status Change by Admin
  const handleUpdateStatus = async (
    participantId: string,
    newStatus: string
  ) => {
    try {
      setUpdatingId(participantId);
      const res = await fetch(`/api/sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          status: newStatus,
        }),
      });

      if (res.ok) {
        toast.success("Status absensi berhasil diperbarui.");
        fetchDetail();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Broadcast WA
  const handleBroadcastWA = async () => {
    const confirmed = await confirm({
      title: "Broadcast Pengumuman Sesi",
      message: "Apakah Anda yakin ingin mengirim pengumuman sesi ini ke WhatsApp seluruh peserta?",
      confirmText: "Ya, Broadcast WA",
      cancelText: "Batal",
      variant: "info",
      icon: "send",
    });

    if (!confirmed) {
      return;
    }
    try {
      setIsBroadcasting(true);
      setAlertMessage(null);
      const res = await fetch(`/api/sessions/${sessionId}/broadcast`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal mem-broadcast pengumuman");

      const successMsg = `Broadcast Berhasil! Terkirim ke ${data.successCount} peserta.`;
      setAlertMessage({
        type: "success",
        text: successMsg,
      });
      toast.success(successMsg);
    } catch (err: any) {
      const errorText = err.message || "Gagal mem-broadcast pengumuman";
      setAlertMessage({
        type: "error",
        text: errorText,
      });
      toast.error(errorText);
    } finally {
      setIsBroadcasting(false);
    }
  };

  // Follow-up Peserta Alpa WA
  const handleFollowupAlpaWA = async () => {
    const confirmed = await confirm({
      title: "Follow-up Peserta Alpa",
      message: "Kirim pesan notifikasi pengingat via WhatsApp DM ke SELURUH peserta yang tercatat ALPA (Tidak Hadir)?",
      confirmText: "Ya, Kirim Notifikasi Alpa",
      cancelText: "Batal",
      variant: "warning",
      icon: "send",
    });

    if (!confirmed) return;

    try {
      setIsFollowingUpAlpa(true);
      const res = await fetch(`/api/sessions/${sessionId}/followup-alpa`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mem-broadcast follow-up Alpa");

      toast.success(`Follow-up Berhasil! Terkirim ke ${data.successCount} peserta Alpa.`);
    } catch (err: any) {
      toast.error(err.message || "Gagal mem-broadcast follow-up Alpa");
    } finally {
      setIsFollowingUpAlpa(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    window.open(`/api/sessions/${sessionId}/export`, "_blank");
  };

  // Filtered Participants
  const filteredList = participants.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phoneNumber.includes(searchQuery) ||
      p.studentClass.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "HADIR" && p.status === "HADIR") ||
      (statusFilter === "IZIN" && (p.status === "IZIN" || p.status === "SAKIT")) ||
      (statusFilter === "ALPA" && p.status === "ALPA") ||
      (statusFilter === "BELUM_ABSEN" && p.status === "BELUM_ABSEN");

    return matchesSearch && matchesStatus;
  });

  const totalItems = filteredList.length;
  const totalPages = pageSize === "ALL" ? 1 : Math.ceil(totalItems / pageSize) || 1;
  const paginatedList =
    pageSize === "ALL"
      ? filteredList
      : filteredList.slice((page - 1) * pageSize, page * pageSize);

  // Summary Counters
  const hadirCount = participants.filter((p) => p.status === "HADIR").length;
  const izinCount = participants.filter((p) => p.status === "IZIN" || p.status === "SAKIT").length;
  const alpaCount = participants.filter((p) => p.status === "ALPA").length;
  const belumAbsenCount = participants.filter((p) => p.status === "BELUM_ABSEN").length;

  if (isLoading || !session) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-xs sm:text-sm text-slate-600 font-medium">Memuat data rekap absensi sesi...</p>
      </div>
    );
  }

  const formattedDate = new Date(session.date).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
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

  const isExpired = new Date() > new Date(session.endTime);

  return (
    <div className="space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin/sessions"
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Sesi</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {!isExpired && (
            <>
              <button
                onClick={handleFollowupAlpaWA}
                disabled={isFollowingUpAlpa}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                title="Kirim notifikasi pengingat WA ke peserta yang Alpa (Tidak Hadir)"
              >
                {isFollowingUpAlpa ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-rose-600" />
                )}
                <span>Follow-up Alpa (WA)</span>
              </button>

              <button
                onClick={handleBroadcastWA}
                disabled={isBroadcasting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                {isBroadcasting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-blue-600" />
                )}
                <span>Broadcast Undangan WA</span>
              </button>
            </>
          )}

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel (.csv)</span>
          </button>
        </div>
      </div>

      {/* Session Summary Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Detail Rekap Kehadiran
            </span>
            <h1 className="text-2xl font-black text-slate-900 mt-0.5">{session.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {isExpired ? (
              <span className="px-3 py-1 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5">
                🔒 Sesi Selesai (Data Absensi Terkunci)
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Real-time Live Sync
              </span>
            )}

            <span
              className={`px-3 py-1 rounded-full font-bold border ${
                !isExpired && session.isActive
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {!isExpired && session.isActive ? "● Sesi Aktif Absen" : "○ Sesi Ditutup"}
            </span>
          </div>
        </div>

        {/* Info Items */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-xs">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <Clock className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <span className="text-slate-500 block">Jadwal & Jam Absen</span>
              <strong className="text-slate-900 font-bold">
                {formattedDate} ({startTimeStr} - {endTimeStr} WIB)
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <span className="text-slate-500 block">Lokasi & Radius GPS</span>
              <strong className="text-slate-900 font-bold">
                {session.locationName || "Titik Default"} (Radius: {session.radiusMeter}m)
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <Users className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="text-slate-500 block">Total Peserta Terdaftar</span>
              <strong className="text-slate-900 font-bold">{participants.length} Orang</strong>
            </div>
          </div>
        </div>

        {/* Status Counters Bar (4 Columns) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
            <span className="text-xs text-emerald-800 font-bold">Hadir (GPS)</span>
            <div className="text-2xl font-black text-emerald-700 mt-0.5">{hadirCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-center">
            <span className="text-xs text-amber-800 font-bold">Izin / Sakit</span>
            <div className="text-2xl font-black text-amber-700 mt-0.5">{izinCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-center">
            <span className="text-xs text-rose-800 font-bold">Tidak Hadir (Alpa)</span>
            <div className="text-2xl font-black text-rose-700 mt-0.5">{alpaCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-xs text-slate-600 font-bold">Belum Absen</span>
            <div className="text-2xl font-black text-slate-800 mt-0.5">{belumAbsenCount}</div>
          </div>
        </div>
      </div>

      {/* Alert Message */}
      {alertMessage && (
        <div
          className={`flex items-center gap-3 p-4 rounded-2xl text-xs sm:text-sm font-semibold border ${
            alertMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {alertMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{alertMessage.text}</span>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama, kelas, atau No. WA..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-emerald-500 font-medium cursor-pointer"
          >
            <option value="ALL">Semua Status Kehadiran</option>
            <option value="HADIR">Hadir (GPS)</option>
            <option value="IZIN">Izin / Sakit</option>
            <option value="ALPA">Tidak Hadir (Alpa)</option>
            <option value="BELUM_ABSEN">Belum Absen</option>
          </select>
        </div>
      </div>

      {/* Attendance Participants Table */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-4">No</th>
                <th className="p-4">Nama Peserta</th>
                <th className="p-4">Kelas</th>
                <th className="p-4">No. WhatsApp</th>
                <th className="p-4">Status Kehadiran</th>
                <th className="p-4">Jam Absen</th>
                <th className="p-4">Jarak GPS</th>
                <th className="p-4">Catatan</th>
                <th className="p-4 text-right">Aksi Manual Admin</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-slate-800">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 font-medium">
                    Tidak ada data peserta yang cocok dengan pencarian / filter.
                  </td>
                </tr>
              ) : (
                paginatedList.map((p, idx) => {
                  const isUpdatingThis = updatingId === p.participantId;
                  const itemIndex = (pageSize === "ALL" ? 0 : (page - 1) * pageSize) + idx + 1;
                  const timeStr = p.checkInTime
                    ? new Date(p.checkInTime).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-";

                  return (
                    <tr
                      key={p.participantId}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="p-4 font-mono text-slate-400 font-semibold">{itemIndex}</td>

                      <td className="p-4 font-bold text-slate-900">
                        {p.name}
                      </td>

                      <td className="p-4 font-medium text-slate-700">
                        {p.studentClass}
                      </td>

                      <td className="p-4 font-mono text-slate-600">
                        +{p.phoneNumber}
                      </td>

                      <td className="p-4">
                        {p.status === "HADIR" ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Hadir
                          </span>
                        ) : p.status === "IZIN" || p.status === "SAKIT" ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {p.status}
                          </span>
                        ) : p.status === "ALPA" ? (
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Alpa
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                            Belum Absen
                          </span>
                        )}
                      </td>

                      <td className="p-4 font-mono font-medium text-slate-700">
                        {timeStr}
                      </td>

                      <td className="p-4 font-mono font-semibold text-slate-700">
                        {p.distanceMeter !== null ? (
                          <span
                            className={
                              p.distanceMeter <= session.radiusMeter
                                ? "text-emerald-700 font-bold"
                                : "text-amber-800 font-bold"
                            }
                          >
                            {p.distanceMeter}m
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">-</span>
                        )}
                      </td>

                      <td className="p-4 text-slate-600 text-xs max-w-xs truncate" title={p.notes || ""}>
                        {p.notes || "-"}
                      </td>

                      <td className="p-4 text-right">
                        {isExpired ? (
                          <span className="text-slate-400 italic text-[11px]">Terkunci</span>
                        ) : isUpdatingThis ? (
                          <Loader2 className="w-4 h-4 text-emerald-600 animate-spin ml-auto" />
                        ) : (
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              onClick={() => handleUpdateStatus(p.participantId, "HADIR")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                p.status === "HADIR"
                                  ? "bg-emerald-600 text-white shadow-sm"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                              }`}
                              title="Tandai Hadir"
                            >
                              Hadir
                            </button>

                            <button
                              onClick={() => handleUpdateStatus(p.participantId, "IZIN")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                p.status === "IZIN"
                                  ? "bg-amber-600 text-white shadow-sm"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                              }`}
                              title="Tandai Izin"
                            >
                              Izin
                            </button>

                            <button
                              onClick={() => handleUpdateStatus(p.participantId, "ALPA")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                p.status === "ALPA"
                                  ? "bg-rose-600 text-white shadow-sm"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                              }`}
                              title="Tandai Tidak Hadir (Alpa)"
                            >
                              Alpa
                            </button>

                            <button
                              onClick={() => handleUpdateStatus(p.participantId, "DELETE")}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 transition-colors text-xs cursor-pointer"
                              title="Reset status"
                            >
                              Reset
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            itemLabel="peserta"
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Interactive Map & GPS Validation Card (Bottom Section) */}
      {session.latitude != null && session.longitude != null && (
        <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-200">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Peta Titik Koordinat GPS Perkumpulan</h3>
                <p className="text-xs text-slate-500">
                  Visualisasi titik kumpul lokasi absensi ({session.locationName || "Titik Kumpul"})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`https://www.google.com/maps?q=${session.latitude},${session.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Buka di Google Maps ↗</span>
              </a>
            </div>
          </div>

          {/* Map Embed Frame */}
          <div className="relative w-full h-72 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 shadow-inner">
            <iframe
              title="Peta Titik Absensi"
              width="100%"
              height="100%"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${session.longitude - 0.004}%2C${session.latitude - 0.003}%2C${session.longitude + 0.004}%2C${session.latitude + 0.003}&layer=mapnik&marker=${session.latitude}%2C${session.longitude}`}
              className="w-full h-full"
            />
          </div>

          {/* Coordinate Details Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <div className="flex items-center gap-4">
              <span>
                Latitude: <strong className="text-emerald-700 font-mono font-bold">{session.latitude}</strong>
              </span>
              <span>
                Longitude: <strong className="text-emerald-700 font-mono font-bold">{session.longitude}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Radius Validasi: {session.radiusMeter} Meter</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

