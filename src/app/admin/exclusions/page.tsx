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
    <div className="space-y-6 max-w-5xl text-slate-900 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          Exclusion List Management <ShieldAlert className="w-5 h-5 text-amber-500" />
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Daftar nomor pimpinan, pembina, atau admin yang <b>DIKECUALIKAN</b> dari broadcast & pesan otomatis bot WhatsApp.
        </p>
      </div>

      {/* Add Exclusion Form Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600" /> Tambah Nomor Pengecualian Baru
        </h3>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAddExclusion} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nomor WhatsApp *
            </label>
            <input
              type="text"
              required
              placeholder="081234567890"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Keterangan / Nama Pimpinan
            </label>
            <input
              type="text"
              placeholder="Pembina Ekskul (Pak Alex)"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Menyimpan..." : "Tambah Pengecualian"}
            </button>
          </div>
        </form>
      </div>

      {/* Exclusions Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4">No. WhatsApp</th>
                <th className="py-3.5 px-4">Keterangan / Nama</th>
                <th className="py-3.5 px-4">Tanggal Ditambahkan</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
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
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-700">
                      +{item.phoneNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {item.name || "Admin / Pembina"}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {new Date(item.createdAt).toLocaleString("id-ID")}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleRemoveExclusion(item.id)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer border border-rose-200"
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
