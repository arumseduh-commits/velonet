import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Users,
  Zap,
  BookOpen,
} from "lucide-react";

export const metadata = {
  title: "Velocity English Community - Portal Pendaftaran & Presensi",
  description:
    "Portal Resmi Pendaftaran, Pendataan Anggota Komunitas Bahasa Inggris Velocity & Absensi Modern.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <header className="max-w-7xl w-full mx-auto px-6 py-5 flex items-center justify-between z-20 border-b border-slate-200/80 bg-white/70 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-blue-500/25">
            V
          </div>
          <div>
            <span className="font-extrabold text-xl text-slate-900 tracking-tight">
              Velocity <span className="text-blue-600">English</span>
            </span>
            <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
              Community & Extracurricular
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/materi"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all border border-slate-200"
          >
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Materi & Kuis</span>
          </Link>
          <Link
            href="/student/login"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Portal Siswa</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl w-full mx-auto px-6 py-16 flex-1 flex flex-col justify-center items-center text-center relative space-y-16">
        {/* Glow background effects */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[320px] bg-blue-500/10 blur-[130px] rounded-full pointer-events-none -z-10" />

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Portal Resmi Komunitas Velocity</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
            Tingkatkan Skill Bahasa Inggris Kamu Bersama{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600">
              Velocity Community
            </span>
          </h1>

          <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-normal">
            Selamat datang di portal resmi Komunitas Bahasa Inggris Velocity. Nikmati pendaftaran praktis via <b>WhatsApp OTP</b>, presensi pintar <b>Face Recognition & GPS</b>, serta akses ratusan bank materi & kuis interaktif.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full sm:w-auto">
            <Link
              href="/student/login"
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>Masuk Portal Siswa</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/materi"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm border border-slate-200 shadow-xs transition-all cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Buka Library Materi</span>
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          <div className="bg-white border border-slate-200/80 shadow-md shadow-slate-200/50 rounded-3xl p-6 space-y-3 hover:border-blue-300 hover:shadow-lg transition-all">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Otomatis & Cepat</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Login praktis menggunakan WhatsApp OTP / Magic Link tanpa perlu mengingat kata sandi.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-md shadow-slate-200/50 rounded-3xl p-6 space-y-3 hover:border-emerald-300 hover:shadow-lg transition-all">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Komunitas Interaktif</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bergabung dalam sesi latihan speaking, diskusi seru Bahasa Inggris, dan absensi GPS pertemuan.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-md shadow-slate-200/50 rounded-3xl p-6 space-y-3 hover:border-indigo-300 hover:shadow-lg transition-all">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Presensi Biometrik & GPS</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Presensi kehadiran akurat dengan pemindaian wajah cerdas dan validasi radius lokasi GPS secara real-time.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-12 bg-white/50">
        <p>© 2026 Velocity English Community. All rights reserved.</p>
      </footer>
    </div>
  );
}
