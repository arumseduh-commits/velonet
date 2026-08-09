"use client";

export const dynamic = "force-dynamic";

import React, { useState } from "react";
import { FileText, Send, CheckCircle2, AlertCircle, RefreshCw, Calendar, FileCheck } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

export default function StudentLeaveFormPage() {
  const { toast } = useDialog();

  const [type, setType] = useState<"IZIN" | "SAKIT">("IZIN");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      toast.warning("Masukkan alasan atau keterangan izin/sakit Anda.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/student/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          notes: notes.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Pengajuan izin/sakit berhasil dicatat!");
        setNotes("");
      } else {
        toast.error(json.error || "Gagal mengizinkan sesi.");
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-6 max-w-3xl mx-auto pb-24 md:pb-8">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/20 shadow-xl space-y-1">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6 text-amber-400" />
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
            Form Pengajuan Izin / Sakit
          </h1>
        </div>
        <p className="text-xs text-slate-400">
          Ajukan ketidakhadiran Anda pada sesi pertemuan ekskul Velocity secara resmi via Web
        </p>
      </div>

      {/* Leave Form Card */}
      <form onSubmit={handleSubmitLeave} className="space-y-6">
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-5 shadow-xl">
          {/* Radio Type Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Pilih Kategori Keterangan</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("IZIN")}
                className={`py-3 px-4 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  type === "IZIN"
                    ? "bg-amber-600/20 border-amber-500 text-amber-300 shadow-lg shadow-amber-500/10"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>IZIN (Acara Keluarga / Penting)</span>
              </button>

              <button
                type="button"
                onClick={() => setType("SAKIT")}
                className={`py-3 px-4 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  type === "SAKIT"
                    ? "bg-rose-600/20 border-rose-500 text-rose-300 shadow-lg shadow-rose-500/10"
                    : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-900"
                }`}
              >
                <FileCheck className="w-4 h-4" />
                <span>SAKIT (Kondisi Kesehatan)</span>
              </button>
            </div>
          </div>

          {/* Notes Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              Alasan & Keterangan Lengkap
            </label>
            <textarea
              rows={4}
              placeholder="Tuliskan alasan izin/sakit secara sopan dan jelas. Contoh: Izin tidak dapat hadir karena ada acara keluarga di luar kota."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors resize-none placeholder:text-slate-600"
              required
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Pengajuan izin ini akan otomatis tercatat di rekap absensi Sesi Pertemuan Velocity hari ini dan diketahui oleh Pembina.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !notes.trim()}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Mengirim Pengajuan...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Kirim Pengajuan {type}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
