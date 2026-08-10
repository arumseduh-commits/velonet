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
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

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
    // Real-time Auto-Sync Poller (Every 3.5s)
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
        if (selectedParticipant?.id === id) setSelectedParticipant(null);
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
        <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-semibold inline-flex items-center gap-1">
          <Shield className="w-3 h-3 text-slate-400" /> EXCLUDED
        </span>
      );
    }

    switch (status) {
      case "COMPLETED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold inline-flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> COMPLETED
          </span>
        );
      case "OPTED_OUT":
        return (
          <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold inline-flex items-center gap-1">
            <UserX className="w-3 h-3" /> OPTED OUT
          </span>
        );
      case "WAITING_CONFIRMATION":
      case "NOT_STARTED":
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> WAITING CONFIRMATION
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold">
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Data Peserta Velocity</h1>
          <p className="text-sm text-slate-400 mt-1">
            Daftar lengkap peserta, status pendaftaran, dan aksi massal
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Peserta</span>
          </button>

          <a
            href="/api/participants/export?format=xlsx"
            download
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Ekspor Excel (.xlsx)</span>
          </a>
        </div>
      </div>

      {/* Tabs Navigation: Aktif (Default) | Menunggu | Semua */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab("ACTIVE")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "ACTIVE"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
              : "bg-slate-900/80 hover:bg-slate-800 text-slate-400 border border-slate-800"
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>Peserta Aktif (Lanjut)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === "ACTIVE" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
            }`}
          >
            {activeCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("WAITING")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "WAITING"
              ? "bg-amber-600 text-white shadow-lg shadow-amber-600/25"
              : "bg-slate-900/80 hover:bg-slate-800 text-slate-400 border border-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Menunggu Konfirmasi</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === "WAITING" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
            }`}
          >
            {waitingCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("ALL")}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "ALL"
              ? "bg-slate-700 text-white shadow-lg shadow-slate-700/25"
              : "bg-slate-900/80 hover:bg-slate-800 text-slate-400 border border-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Semua Peserta</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === "ALL" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
            }`}
          >
            {totalCount}
          </span>
        </button>
      </div>

      {/* Floating Bulk Action Bar (Shows when items selected) */}
      {selectedIds.length > 0 && (
        <div className="p-4 rounded-2xl bg-blue-950/90 border border-blue-500/40 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-extrabold">
              {selectedIds.length} Terpilih
            </span>
            <p className="text-xs text-blue-200 font-medium">
              Pilih aksi yang ingin diterapkan pada peserta terpilih:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleBulkExclude}
              disabled={bulkActionLoading}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/40 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Kecualikan Terpilih</span>
            </button>

            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus {selectedIds.length} Terpilih</span>
            </button>

            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
            >
              Batal Pilih
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl glass-panel border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama, nomor HP, atau kelas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700"
          >
            Cari
          </button>
        </form>

        {activeTab === "ALL" && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 cursor-pointer"
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
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Datatable with Checkbox Bulk Actions */}
      <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                <th className="py-3.5 px-4">Status Pendaftaran</th>
                <th className="py-3.5 px-4">Terakhir Kontak</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                    Memuat data peserta...
                  </td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
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
                      className={`hover:bg-slate-800/80 transition-colors cursor-pointer group ${
                        isSelected ? "bg-blue-950/30" : ""
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
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-300 group-hover:text-blue-400 transition-colors">
                        +{p.phoneNumber}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white group-hover:text-blue-300 transition-colors">
                        {p.name || <span className="text-slate-500 font-normal">-</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.studentClass || <span className="text-slate-500">-</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(p.status, p.isExcluded)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {p.lastSentAt
                          ? new Date(p.lastSentAt).toLocaleString("id-ID")
                          : "Belum pernah"}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
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

      {/* Detail Modal */}
      {selectedParticipant && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedParticipant(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Add Participant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white">Tambah Peserta Manual</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddParticipant} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nomor WhatsApp (Wajib)
                </label>
                <input
                  type="text"
                  placeholder="08123456789 atau 628123456789"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Lengkap (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ahmad Rizky"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kelas / Angkatan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: XI RPL 1"
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="newExcluded"
                  checked={newExcluded}
                  onChange={(e) => setNewExcluded(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
                <label htmlFor="newExcluded" className="text-xs text-slate-300 cursor-pointer">
                  Kecualikan dari pesan WhatsApp bot (Exclusion List)
                </label>
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
                  {errorMsg}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
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
