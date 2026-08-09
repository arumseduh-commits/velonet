"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import { User, Phone, BookOpen, Heart, Sparkles, ShieldCheck, RefreshCw, CheckCircle2 } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface StudentData {
  id: string;
  name: string;
  phoneNumber: string;
  studentClass: string;
  motivation: string;
  hobby: string;
}

export default function StudentProfilePage() {
  const { toast } = useDialog();

  const [student, setStudent] = useState<StudentData | null>(null);
  const [motivation, setMotivation] = useState("");
  const [hobby, setHobby] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/student/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.student) {
          const s = json.data.student;
          setStudent(s);
          setMotivation(s.motivation || "");
          setHobby(s.hobby || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivation: motivation.trim(),
          hobby: hobby.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Profil Anda berhasil diperbarui!");
      } else {
        toast.error(json.error || "Gagal memperbarui profil.");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui profil.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
        <span className="text-sm font-medium">Memuat Profil Siswa...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-6 max-w-4xl mx-auto pb-24 md:pb-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/20 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-extrabold text-white text-3xl shadow-lg shadow-blue-500/20 shrink-0">
            {student?.name?.charAt(0).toUpperCase() || "S"}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide flex items-center gap-2">
              <span>{student?.name}</span>
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Anggota Resmi Komunitas Ekskul Velocity • Kelas {student?.studentClass}
            </p>
          </div>
        </div>
      </div>

      {/* Profile Form Card */}
      <form onSubmit={handleUpdateProfile} className="space-y-6">
        <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-5 shadow-xl">
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2 pb-3 border-b border-slate-800">
            <User className="w-5 h-5 text-blue-400" />
            <span>Informasi Profil & Data Diri</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Nama Lengkap</label>
              <input
                type="text"
                value={student?.name || ""}
                disabled
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-400 cursor-not-allowed font-medium"
              />
              <p className="text-[10px] text-slate-500">Hubungi Pembina jika ada kesalahan penulisan nama.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Kelas / Tingkat</label>
              <input
                type="text"
                value={student?.studentClass || ""}
                disabled
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-400 cursor-not-allowed font-medium"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300">Nomor WhatsApp Terhubung</label>
              <div className="relative">
                <input
                  type="text"
                  value={`+${student?.phoneNumber || ""}`}
                  disabled
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-emerald-400 cursor-not-allowed font-medium"
                />
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>Hobi & Minat</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Reading, Gaming, Listening to Music"
                value={hobby}
                onChange={(e) => setHobby(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                <span>Motivasi Mengikuti Ekskul Velocity</span>
              </label>
              <textarea
                rows={3}
                placeholder="Tuliskan alasan & impian kamu bergabung di Velocity..."
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Perubahan Profil</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
