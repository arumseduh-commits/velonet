"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getParticipantSlug } from "@/lib/slug";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  Search,
  Plus,
  Trash2,
  Filter,
  RefreshCw,
  X,
  CheckCircle,
  Clock,
  UserX,
  Shield,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Send,
  ShieldAlert,
  Users,
  Camera,
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
  faceDescriptor?: string | null;
  facePhoto?: string | null;
  createdAt: string;
}

export default function ParticipantsPage() {
  const router = useRouter();
  const { confirm, toast } = useDialog();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Default Tab Status Filter: ACTIVE (Peserta Aktif / COMPLETED)
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "WAITING" | "ALL">("ACTIVE");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Bulk Action State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Add Participant Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState("");
  const [newExcluded, setNewExcluded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // All fetched participants for calculating tab badge counts
  const [allParticipantsForBadges, setAllParticipantsForBadges] = useState<Participant[]>([]);

  const fetchParticipants = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const url = new URL("/api/participants", window.location.origin);
      if (searchQuery) url.searchParams.set("query", searchQuery);
      
      // Handle tab filter
      if (activeTab !== "ALL") {
        url.searchParams.set("status", activeTab);
      } else if (statusFilter !== "ALL") {
        url.searchParams.set("status", statusFilter);
      }

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success) {
        setParticipants(json.data);
      }

      // Also fetch un-filtered for badge counters if needed
      if (!isSilent && !searchQuery) {
        const allRes = await fetch("/api/participants");
        const allJson = await allRes.json();
        if (allJson.success) {
          setAllParticipantsForBadges(allJson.data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch participants:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
    setSelectedIds([]); // reset bulk selection when tab/filter changes
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchParticipants(true);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [activeTab, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchParticipants();
  };

  // Tab Badge Counters
  const activeCount = allParticipantsForBadges.filter((p) => p.status === "COMPLETED").length;
  const waitingCount = allParticipantsForBadges.filter(
    (p) => p.status === "WAITING_CONFIRMATION" || p.status === "WAITING_NAME" || p.status === "NOT_STARTED"
  ).length;
  const totalCount = allParticipantsForBadges.length;

  // Bulk Selection Handlers
  const isAllSelected =
    participants.length > 0 && participants.every((p) => selectedIds.includes(p.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(participants.map((p) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm({
      title: "Hapus Massal Peserta",
      message: `Apakah Anda yakin ingin menghapus ${selectedIds.length} peserta terpilih secara permanen?`,
      confirmText: `Ya, Hapus ${selectedIds.length} Peserta`,
      cancelText: "Batal",
      variant: "danger",
      icon: "trash",
    });

    if (!confirmed) return;

    setBulkActionLoading(true);
    try {
      const res = await fetch("/api/participants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`${selectedIds.length} peserta berhasil dihapus.`);
        setSelectedIds([]);
        fetchParticipants();
      } else {
        toast.error(json.error || "Gagal menghapus peserta.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkExclude = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await confirm({
      title: "Kecualikan Peserta Massal",
      message: `Masukkan ${selectedIds.length} peserta terpilih ke Exclusion List agar tidak di-DM oleh Bot?`,
      confirmText: `Ya, Kecualikan ${selectedIds.length} Peserta`,
      cancelText: "Batal",
      variant: "warning",
      icon: "shield",
    });

    if (!confirmed) return;

    setBulkActionLoading(true);
    try {
      const res = await fetch("/api/participants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, isExcluded: true }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`${selectedIds.length} peserta berhasil dikecualikan.`);
        setSelectedIds([]);
        fetchParticipants();
      } else {
        toast.error(json.error || "Gagal mengecualikan peserta.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: newPhone,
          name: newName,
          studentClass: newClass,
          isExcluded: newExcluded,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setNewPhone("");
        setNewName("");
        setNewClass("");
        setNewExcluded(false);
        toast.success("Peserta baru berhasil ditambahkan.");
        fetchParticipants();
      } else {
        setErrorMsg(json.error || "Gagal menambah peserta.");
        toast.error(json.error || "Gagal menambah peserta.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: "Hapus Peserta",
      message: "Apakah Anda yakin ingin menghapus peserta ini?",
      confirmText: "Ya, Hapus Peserta",
      cancelText: "Batal",
      variant: "danger",
      icon: "trash",
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/participants?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("Peserta berhasil dihapus.");
        fetchParticipants();
      } else {
        toast.error(json.error || "Gagal menghapus peserta.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus peserta.");
    }
  };

  const getStatusBadge = (status: string, isExcluded: boolean) => {
    if (isExcluded) {
      return (
        <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold inline-flex items-center gap-1">
          <Shield className="w-3 h-3 text-slate-500" /> EXCLUDED
        </span>
      );
    }

    switch (status) {
      case "COMPLETED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold inline-flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-600" /> COMPLETED
          </span>
        );
      case "OPTED_OUT":
        return (
          <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold inline-flex items-center gap-1">
            <UserX className="w-3 h-3 text-rose-600" /> OPTED OUT
          </span>
        );
      case "WAITING_CONFIRMATION":
      case "NOT_STARTED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" /> WAITING CONFIRMATION
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Data Peserta Velocity</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Daftar lengkap peserta, status pendaftaran, dan aksi massal
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Peserta</span>
          </button>

          <a
            href="/api/participants/export?format=xlsx"
            download
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor Excel (.xlsx)</span>
          </a>
        </div>
      </div>

      {/* Tabs Navigation: Aktif (Default) | Menunggu | Semua */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab("ACTIVE")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "ACTIVE"
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/25"
              : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm"
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Peserta Aktif (Lanjut)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === "ACTIVE" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {activeCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("WAITING")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "WAITING"
              ? "bg-amber-600 text-white shadow-md shadow-amber-600/25"
              : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Menunggu Konfirmasi</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === "WAITING" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {waitingCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "ALL"
              ? "bg-slate-800 text-white shadow-md shadow-slate-800/25"
              : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Semua Peserta</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === "ALL" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {totalCount}
          </span>
        </button>
      </div>

      {/* Floating Bulk Action Bar (Shows when items selected) */}
      {selectedIds.length > 0 && (
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-black">
              {selectedIds.length} Terpilih
            </span>
            <p className="text-xs text-blue-900 font-semibold">
              Pilih aksi yang ingin diterapkan pada peserta terpilih:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleBulkExclude}
              disabled={bulkActionLoading}
              className="px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              <span>Kecualikan Terpilih</span>
            </button>

            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus {selectedIds.length} Terpilih</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              Batal Pilih
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama, nomor HP, atau kelas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            Cari
          </button>
        </form>

        {activeTab === "ALL" && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
            >
              <option value="ALL">Semua Status Detail</option>
              <option value="COMPLETED">COMPLETED (Lanjut)</option>
              <option value="WAITING_CONFIRMATION">WAITING CONFIRMATION</option>
              <option value="WAITING_NAME">WAITING NAME</option>
              <option value="OPTED_OUT">OPTED OUT (Tidak Lanjut)</option>
            </select>
          </div>
        )}

        <button
          onClick={() => fetchParticipants()}
          className="p-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-300 shadow-sm cursor-pointer"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
        </button>
      </div>

      {/* Datatable with Checkbox Bulk Actions */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                    title="Pilih Semua"
                  />
                </th>
                <th className="py-3.5 px-4">No. WhatsApp</th>
                <th className="py-3.5 px-4">Nama Lengkap</th>
                <th className="py-3.5 px-4">Kelas</th>
                <th className="py-3.5 px-4">Face ID</th>
                <th className="py-3.5 px-4">Status Pendaftaran</th>
                <th className="py-3.5 px-4">Terakhir Kontak</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-medium">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    Memuat data peserta...
                  </td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-medium">
                    Tidak ada peserta ditemukan pada tab ini.
                  </td>
                </tr>
              ) : (
                participants.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/admin/participants/${getParticipantSlug(p)}`)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        isSelected ? "bg-blue-50/60" : ""
                      }`}
                    >
                      <td
                        className="py-3.5 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(p.id)}
                          className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">
                        +{p.phoneNumber}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {p.name || <span className="text-slate-400 font-normal">-</span>}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {p.studentClass || <span className="text-slate-400">-</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.faceDescriptor ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold inline-flex items-center gap-1">
                            <Camera className="w-3 h-3 text-emerald-600" /> Terdaftar
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium">
                            Belum
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(p.status, p.isExcluded)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 font-medium">
                        {p.lastSentAt
                          ? new Date(p.lastSentAt).toLocaleString("id-ID")
                          : "Belum pernah"}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                          title="Hapus Peserta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Participant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Tambah Peserta Manual</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddParticipant} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nomor WhatsApp (Wajib)
                </label>
                <input
                  type="text"
                  placeholder="08123456789 atau 628123456789"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder-slate-400"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Lengkap (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ahmad Rizky"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kelas / Angkatan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: XI RPL 1"
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 placeholder-slate-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="newExcluded"
                  checked={newExcluded}
                  onChange={(e) => setNewExcluded(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="newExcluded" className="font-semibold text-slate-700 cursor-pointer">
                  Kecualikan dari pesan WhatsApp bot (Exclusion List)
                </label>
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl font-medium">
                  {errorMsg}
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-blue-600/20"
                >
                  {submitting ? "Menyimpan..." : "Simpan Peserta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

