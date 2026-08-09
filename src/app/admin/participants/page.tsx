"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getParticipantSlug } from "@/lib/slug";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  Search,
  Plus,
  Download,
  Trash2,
  Eye,
  Filter,
  RefreshCw,
  X,
  CheckCircle,
  Clock,
  UserX,
  Shield,
  FileSpreadsheet,
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
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

  // Add Participant Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [newClass, setNewClass] = useState("");
  const [newExcluded, setNewExcluded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchParticipants = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const url = new URL("/api/participants", window.location.origin);
      if (searchQuery) url.searchParams.set("query", searchQuery);
      if (statusFilter !== "ALL") url.searchParams.set("status", statusFilter);

      const res = await fetch(url.toString());
      const json = await res.json();
      if (json.success) {
        setParticipants(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch participants:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
    // Real-time Auto-Sync Poller (Every 3.5s)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchParticipants(true);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchParticipants();
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
            Daftar lengkap peserta, filter status, dan manajemen pendaftaran
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

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="COMPLETED">COMPLETED (Lanjut)</option>
            <option value="WAITING_CONFIRMATION">WAITING CONFIRMATION</option>
            <option value="WAITING_NAME">WAITING NAME</option>
            <option value="OPTED_OUT">OPTED OUT (Tidak Lanjut)</option>
          </select>

          <button
            onClick={() => fetchParticipants()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Datatable */}
      <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                    Memuat data peserta...
                  </td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Tidak ada peserta ditemukan.
                  </td>
                </tr>
              ) : (
                participants.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/admin/participants/${getParticipantSlug(p)}`)}
                    className="hover:bg-slate-800/80 transition-colors cursor-pointer group"
                  >
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
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(p.id);
                        }}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                        title="Hapus Peserta"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
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

            <div>
              <h3 className="text-lg font-bold text-white">Detail Peserta</h3>
              <p className="text-xs text-slate-400">Info lengkap pendaftaran via bot WhatsApp</p>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">No. WhatsApp</span>
                  <p className="font-mono font-semibold text-blue-400 mt-0.5">
                    +{selectedParticipant.phoneNumber}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Status</span>
                  <div className="mt-0.5">
                    {getStatusBadge(selectedParticipant.status, selectedParticipant.isExcluded)}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="text-xs font-semibold text-slate-400">Nama Lengkap:</span>
                  <p className="text-white font-medium">{selectedParticipant.name || "-"}</p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400">Kelas:</span>
                  <p className="text-white font-medium">{selectedParticipant.studentClass || "-"}</p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400">Alasan / Motivasi Belajar:</span>
                  <p className="text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800 mt-1 text-xs leading-relaxed">
                    {selectedParticipant.motivation || "Belum terisi"}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-slate-400">Hobi:</span>
                  <p className="text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800 mt-1 text-xs">
                    {selectedParticipant.hobby || "Belum terisi"}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedParticipant(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddParticipant}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-bold text-white">Tambah Peserta Manual</h3>
              <p className="text-xs text-slate-400">Masukkan nomor WhatsApp peserta</p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-900/30 border border-rose-500/30 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nomor WhatsApp * (Format: 08xxx atau 628xxx)
                </label>
                <input
                  type="text"
                  required
                  placeholder="081234567890"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Lengkap (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kelas (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="X IPA 1"
                  value={newClass}
                  onChange={(e) => setNewClass(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="excludedCheck"
                  checked={newExcluded}
                  onChange={(e) => setNewExcluded(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                />
                <label htmlFor="excludedCheck" className="text-xs text-slate-300 cursor-pointer">
                  Dikecualikan (Jangan kirim pesan bot)
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {submitting ? "Menyimpan..." : "Simpan Peserta"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
