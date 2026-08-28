"use client";

import React, { useState, useEffect } from "react";
import { Lock, ShieldAlert, KeyRound, ArrowRight, AlertTriangle, RefreshCw } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface ExamLockedScreenProps {
  quizId: string;
  strikeCount: number;
  maxStrikes: number;
  onUnlocked: () => void;
}

export default function ExamLockedScreen({
  quizId,
  strikeCount,
  maxStrikes,
  onUnlocked,
}: ExamLockedScreenProps) {
  const { toast } = useDialog();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  // Background polling to auto-detect if supervisor remotely unlocked the student
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/quiz/${quizId}`);
        const json = await res.json();
        if (json.success && json.data?.attempt?.status === "IN_PROGRESS") {
          toast.success("Ujian telah dibuka kembali oleh Pengawas!");
          onUnlocked();
        }
      } catch (e) {
        // silent poll
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [quizId, onUnlocked, toast]);

  const handleUnlockWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      toast.warning("Silakan masukkan PIN Pengawas.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/quiz/${quizId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supervisorPin: pin.trim() }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Ujian berhasil dibuka kembali.");
        onUnlocked();
      } else {
        toast.error(json.error || "PIN Pengawas salah.");
      }
    } catch (err) {
      toast.error("Gagal menghubungi server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-lg overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-rose-200 text-slate-900 my-8 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Lock Animation Icon */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-md">
          <Lock className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
        </div>

        <div className="mt-4">
          <span className="text-[11px] font-extrabold tracking-wider uppercase text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
            Sistem Keamanan VeloExambro
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            Ujian Anda Terkunci
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Terdeteksi {strikeCount} pelanggaran dari batas maksimal {maxStrikes}x strike (keluar fullscreen, pindah tab/aplikasi, atau anomali kamera).
          </p>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-left flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-800 leading-relaxed">
            Untuk melanjutkan ujian, silakan lapor kepada <strong>Pengawas / Guru</strong> untuk meminta <strong>PIN Pembuka</strong> atau menunggu dibuka melalui dashboard pengawas.
          </p>
        </div>

        {/* Form PIN Pengawas */}
        <form onSubmit={handleUnlockWithPin} className="mt-6 space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-blue-600" />
              <span>Masukkan PIN Pengawas</span>
            </label>
            <input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Contoh: 123456"
              maxLength={12}
              className="w-full px-4 py-3 text-center text-lg tracking-widest font-mono font-bold bg-slate-50 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all uppercase"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !pin.trim()}
            className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memverifikasi PIN...</span>
              </>
            ) : (
              <>
                <span>Buka Kunci Ujian</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Menunggu respon remote pengawas secara otomatis...</span>
        </div>
      </div>
    </div>
  );
}
