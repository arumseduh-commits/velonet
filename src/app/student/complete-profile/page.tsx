"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Calendar, Users, GraduationCap, Target, Heart, CheckCircle2, RefreshCw } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

export default function CompleteProfilePage() {
  const router = useRouter();
  const { toast } = useDialog();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    birthDate: "",
    gender: "",
    studentClass: "",
    motivation: "",
    hobby: "",
  });

  useEffect(() => {
    // Memeriksa status siswa
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/student/profile");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            if (json.data.status === "COMPLETED") {
              router.replace("/student");
              return;
            }
            // Prefill nama jika ada
            if (json.data.name) {
              setFormData((prev) => ({ ...prev, name: json.data.name }));
            }
          } else {
            router.replace("/student/login");
          }
        } else {
          router.replace("/student/login");
        }
      } catch (e) {
        toast.error("Gagal memeriksa status profil.");
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/student/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Pendaftaran berhasil dilengkapi!");
        router.push("/student");
      } else {
        toast.error(json.error || "Gagal menyimpan data.");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-emerald-400">
        <RefreshCw className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-medium">Memuat data pendaftaran...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 md:p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/30">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Lengkapi Pendaftaran</h1>
          <p className="text-slate-400 text-sm">
            Selamat datang di VeloNet! Tinggal satu langkah lagi untuk bergabung secara penuh.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nama Lengkap */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
              <User className="w-4 h-4 text-emerald-400" /> Nama Lengkap
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              placeholder="Masukkan nama lengkap Anda..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Tanggal Lahir */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" /> Tanggal Lahir
              </label>
              <input
                type="date"
                required
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              />
            </div>

            {/* Jenis Kelamin */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
                <Users className="w-4 h-4 text-emerald-400" /> Jenis Kelamin
              </label>
              <select
                required
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              >
                <option value="" disabled>Pilih Jenis Kelamin</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
          </div>

          {/* Kelas */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
              <GraduationCap className="w-4 h-4 text-emerald-400" /> Kelas Asal
            </label>
            <input
              type="text"
              required
              value={formData.studentClass}
              onChange={(e) => setFormData({ ...formData, studentClass: e.target.value })}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              placeholder="Misal: X RPL 1, XI TKJ 2..."
            />
          </div>

          {/* Alasan Join */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
              <Target className="w-4 h-4 text-emerald-400" /> Alasan / Motivasi Join
            </label>
            <textarea
              required
              rows={3}
              value={formData.motivation}
              onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
              placeholder="Ceritakan singkat mengapa Anda ingin bergabung dengan komunitas ini..."
            />
          </div>

          {/* Hobi */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1.5">
              <Heart className="w-4 h-4 text-emerald-400" /> Hobi & Minat
            </label>
            <input
              type="text"
              required
              value={formData.hobby}
              onChange={(e) => setFormData({ ...formData, hobby: e.target.value })}
              className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              placeholder="Misal: Coding, Desain Grafis, Membaca..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-6 flex items-center justify-center gap-2 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/25 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <span>SELESAIKAN PENDAFTARAN</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
