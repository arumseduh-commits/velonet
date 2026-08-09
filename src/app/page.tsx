import Link from "next/link";
import {
  Sparkles,
  MessageSquare,
  ShieldCheck,
  Bot,
  ArrowRight,
  CheckCircle2,
  Users,
  Globe,
  Zap,
} from "lucide-react";

export const metadata = {
  title: "Velocity English Community - Pendaftaran Ekskul Bahasa Inggris",
  description:
    "Portal Resmi Pendaftaran dan Pendataan Anggota Komunitas Bahasa Inggris Velocity via WhatsApp Bot Otomatis.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between selection:bg-blue-500 selection:text-white">
      {/* Navigation Header */}
      <header className="max-w-7xl w-full mx-auto px-6 py-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-extrabold text-white text-xl shadow-lg shadow-blue-500/20">
            V
          </div>
          <div>
            <span className="font-extrabold text-xl text-white tracking-tight">
              Velocity <span className="text-blue-400">English</span>
            </span>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              Community & Extracurricular
            </p>
          </div>
        </div>

        <Link
          href="/student/login"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md"
        >
          <Sparkles className="w-4 h-4 text-white" />
          <span>Portal Siswa</span>
        </Link>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl w-full mx-auto px-6 py-12 flex-1 flex flex-col justify-center items-center text-center relative">
        {/* Glow background effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[200px] bg-indigo-600/10 blur-[90px] rounded-full pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold mb-6 animate-pulse">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Pendaftaran Ulang Anggota Ekskul Velocity</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl">
          Tingkatkan Skill Bahasa Inggris Kamu Bersama{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
            Velocity Community
          </span>
        </h1>

        <p className="text-slate-300 text-base sm:text-lg max-w-2xl mt-6 leading-relaxed font-normal">
          Selamat datang di portal resmi pendataan ulang anggota ekskul Bahasa Inggris Velocity. Pendaftaran kini makin cepat dan praktis melalui <b>WhatsApp Registration Bot</b> kami secara otomatis.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 w-full sm:w-auto">
          <Link
            href="/student/login"
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <Sparkles className="w-5 h-5" />
            <span>Masuk Portal Siswa</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left w-full">
          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Otomatis & Cepat</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cukup balas pesan bot di WhatsApp untuk mengonfirmasi keanggotaan dan mengisi data diri secara instan.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Komunitas Interaktif</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bergabung bersama teman-teman sehobi dalam sesi latihan speaking, vocabulary, dan diskusi seru Bahasa Inggris.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Pembimbingan Intensif</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Materi pembelajaran terstruktur yang membantu kamu makin percaya diri berbahasa Inggris di mana saja.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>© 2026 Velocity English Community. Built with Next.js 16 & Baileys WhatsApp Engine.</p>
      </footer>
    </div>
  );
}
