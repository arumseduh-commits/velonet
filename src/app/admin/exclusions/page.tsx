"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Plus, Trash2, RefreshCw, UserCheck } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface ExcludedParticipant {
  id: string;
  phoneNumber: string;
  name: string | null;
  createdAt: string;
}

export default function ExclusionsPage() {
  const { confirm, toast } = useDialog();
  const [exclusions, setExclusions] = useState<ExcludedParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneInput, setPhoneInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchExclusions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/exclusions");
      const json = await res.json();
      if (json.success) {
        setExclusions(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch exclusions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExclusions();
  }, []);

  const handleAddExclusion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneInput,
          name: nameInput || "Admin / Pembina",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPhoneInput("");
        setNameInput("");
        toast.success("Nomor pengecualian berhasil ditambahkan.");
        fetchExclusions();
      } else {
        setErrorMsg(json.error || "Gagal menambahkan nomor pengecualian.");
        toast.error(json.error || "Gagal menambahkan nomor pengecualian.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveExclusion = async (id: string) => {
    const confirmed = await confirm({
      title: "Hapus Pengecualian",
      message: "Apakah Anda yakin ingin menghapus pengecualian untuk nomor ini?",
      confirmText: "Ya, Hapus Pengecualian",
      cancelText: "Batal",
      variant: "danger",
      icon: "shield",
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/exclusions?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast.success("Nomor pengecualian berhasil dihapus.");
        fetchExclusions();
      } else {
        toast.error(json.error || "Gagal menghapus pengecualian.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan.");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          Exclusion List Management <ShieldAlert className="w-5 h-5 text-amber-400" />
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Daftar nomor pimpinan, pembina, atau admin yang <b>DIKECUALIKAN</b> dari broadcast & pesan otomatis bot WhatsApp.
        </p>
      </div>

      {/* Add Exclusion Form Card */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-400" /> Tambah Nomor Pengecualian Baru
        </h3>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-900/30 border border-rose-500/30 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAddExclusion} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nomor WhatsApp *
            </label>
            <input
              type="text"
              required
              placeholder="081234567890"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Keterangan / Nama Pimpinan
            </label>
            <input
              type="text"
              placeholder="Pembina Ekskul (Pak Alex)"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Menyimpan..." : "Tambah Pengecualian"}
            </button>
          </div>
        </form>
      </div>

      {/* Exclusions Table */}
      <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">No. WhatsApp</th>
                <th className="py-3.5 px-4">Keterangan / Nama</th>
                <th className="py-3.5 px-4">Tanggal Ditambahkan</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                    Memuat daftar pengecualian...
                  </td>
                </tr>
              ) : exclusions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Belum ada nomor yang dikecualikan.
                  </td>
                </tr>
              ) : (
                exclusions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-amber-300">
                      +{item.phoneNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {item.name || "Admin / Pembina"}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {new Date(item.createdAt).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleRemoveExclusion(item.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                        title="Hapus Pengecualian"
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
    </div>
  );
}
