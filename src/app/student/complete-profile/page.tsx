"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Calendar, Users, GraduationCap, Target, Heart, CheckCircle2, RefreshCw, LogOut } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

export default function CompleteProfilePage() {
  const router = useRouter();
  const { toast } = useDialog();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    birthDate: "",
    gender: "",
    studentClass: "",
    motivation: "",
    hobby: "",
  });

  useEffect(() => {
    let isMounted = true;

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
            if (isMounted) {
              setPhoneNumber(json.data.phoneNumber || "");
              setFormData({
                name: (json.data.name || "").toUpperCase(),
                birthDate: json.data.birthDate || "",
                gender: json.data.gender || "",
                studentClass: json.data.studentClass || "",
                motivation: json.data.motivation || "",
                hobby: json.data.hobby || "",
              });
            }
          } else {
            router.replace("/student/login");
          }
        } else {
          router.replace("/student/login");
        }
      } catch (e) {
        console.error("Failed to check profile status:", e);
        toast.error("Gagal memeriksa status profil.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, [router, toast]);

  const handleLogout = async () => {
    try {
      await fetch("/api/student/auth/logout", { method: "POST" });
      router.replace("/student/login");
    } catch (e) {
      router.replace("/student/login");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.gender) {
      toast.error("Silakan pilih jenis kelamin.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/student/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Pendaftaran berhasil dilengkapi! Selamat datang di VeloNet. 🎉");
        router.push("/student");
      } else {
        toast.error(json.error || "Gagal menyimpan data.");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan koneksi ke server.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-emerald-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium text-slate-300">Memuat formulir pendaftaran...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-500/20 shrink-0">
              V
            </div>
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
                Langkah Terakhir
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide mt-1">
                Lengkapi Pendaftaran
              </h1>
            </div>
          </div>

          <button
            onClick={handleLogout}
            type="button"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 border border-slate-700/50 transition-colors"
            title="Keluar"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {phoneNumber ? (
            <>Nomor WhatsApp Anda (<strong>+{phoneNumber}</strong>) telah terverifikasi. </>
          ) : (
            <>WhatsApp Anda telah terverifikasi. </>
          )}
          Silakan lengkapi biodata berikut untuk mengaktifkan akun dan mengakses Portal Siswa Velocity.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. Nama Lengkap (Otomatis Kapital) */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-400" />
              <span>Nama Lengkap <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
              placeholder="CONTOH: AHMAD FAUZI SYAHPUTRA"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-semibold tracking-wide uppercase transition-colors"
            />
            <p className="text-[11px] text-slate-500">Format otomatis menggunakan huruf KAPITAL.</p>
          </div>

          {/* 2. Tanggal Lahir & Jenis Kelamin Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tanggal Lahir */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>Tanggal Lahir <span className="text-rose-400">*</span></span>
              </label>
              <input
                type="date"
                required
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-medium transition-colors"
              />
            </div>

            {/* Jenis Kelamin */}
            <div className="space-y-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Jenis Kelamin <span className="text-rose-400">*</span></span>
              </label>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: "Laki-laki" })}
                  className={`py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    formData.gender === "Laki-laki"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span>👨 Laki-laki</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, gender: "Perempuan" })}
                  className={`py-3 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    formData.gender === "Perempuan"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/10"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span>👩 Perempuan</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. Kelas */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span>Kelas Asal <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="text"
              required
              value={formData.studentClass}
              onChange={(e) => setFormData({ ...formData, studentClass: e.target.value })}
              placeholder="Contoh: X RPL 1 / XI IPA 2 / XII TKJ 1"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-medium transition-colors"
            />
          </div>

          {/* 4. Alasan / Motivasi Join */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Alasan / Motivasi Masuk <span className="text-rose-400">*</span></span>
            </label>
            <textarea
              required
              rows={3}
              value={formData.motivation}
              onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
              placeholder="Ceritakan singkat mengapa Anda ingin bergabung dengan komunitas ini..."
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-medium resize-none transition-colors"
            />
          </div>

          {/* 5. Hobi */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Heart className="w-4 h-4 text-emerald-400" />
              <span>Hobi & Minat <span className="text-rose-400">*</span></span>
            </label>
            <input
              type="text"
              required
              value={formData.hobby}
              onChange={(e) => setFormData({ ...formData, hobby: e.target.value })}
              placeholder="Contoh: Coding, Desain Grafis, Membaca, Badminton..."
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-medium transition-colors"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-4"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan Pendaftaran...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>SELESAIKAN PENDAFTARAN</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
