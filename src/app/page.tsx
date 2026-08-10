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
  BookOpen,
  BrainCircuit,
  Volume2,
  GraduationCap,
} from "lucide-react";

export const metadata = {
  title: "Velocity English Community - Portal Pendaftaran & Bank Materi",
  description:
    "Portal Resmi Pendaftaran, Pendataan Anggota Komunitas Bahasa Inggris Velocity & Bank Materi Kuis Interaktif MisterGuru.",
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

        <div className="flex items-center gap-3">
          <Link
            href="/materi"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition-all"
          >
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span>Bank Materi & Kuis</span>
          </Link>

          <Link
            href="/student/login"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-500/20"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>Portal Siswa</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl w-full mx-auto px-6 py-12 flex-1 flex flex-col justify-center items-center text-center relative space-y-16">
        {/* Glow background effects */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-600/15 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold animate-pulse">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Pendaftaran Ulang & Learning Hub Velocity</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto">
            Tingkatkan Skill Bahasa Inggris Kamu Bersama{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
              Velocity Community
            </span>
          </h1>

          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed font-normal">
            Selamat datang di portal resmi Komunitas Bahasa Inggris Velocity. Nikmati pendaftaran praktis via <b>WhatsApp OTP</b> dan <b>Bank Materi & Kuis Interaktif MisterGuru</b>.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full sm:w-auto">
            <Link
              href="/materi"
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <BookOpen className="w-5 h-5 text-amber-300" />
              <span>Buka Bank Materi & Kuis</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/student/login"
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm border border-slate-700 transition-all cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span>Masuk Portal Siswa</span>
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-3 hover:border-blue-500/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Otomatis & Cepat</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Login praktis menggunakan WhatsApp OTP / Magic Link tanpa perlu mengingat kata sandi.
            </p>
          </div>

          <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-3 hover:border-blue-500/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Komunitas Interaktif</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bergabung dalam sesi latihan speaking, diskusi seru Bahasa Inggris, dan absensi GPS pertemuan.
            </p>
          </div>

          <div className="p-6 rounded-3xl glass-panel border border-slate-800 space-y-3 hover:border-blue-500/40 transition-all">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Globe className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">MisterGuru Learning Hub</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Akses gratis bank materi Grammar, TOEIC, Speaking & Vocabulary yang dikurasi langsung dari MisterGuru.web.id.
            </p>
          </div>
        </div>

        {/* MisterGuru Hub Showcase Banner */}
        <div className="w-full p-8 rounded-3xl bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/80 border border-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-6 text-left shadow-2xl relative overflow-hidden">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold">
              <GraduationCap className="w-4 h-4 text-amber-300" />
              <span>POWERED BY MISTERGURU.WEB.ID</span>
            </div>

            <h2 className="text-2xl font-bold text-white tracking-wide">
              Fitur Baru: Bank Materi & Kuis Interaktif dengan Audio Native TTS
            </h2>

            <p className="text-xs text-slate-300 leading-relaxed">
              Pelajari materi Grammar, TOEIC, Speaking Dialogues, dan Vocabulary Builder. Setiap materi dilengkapi <b>Audio Pelafalan Native Text-to-Speech</b> dan <b>Kuis Interaktif Pilihan Ganda (A/B/C/D)</b>!
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400 pt-1">
              <span className="flex items-center gap-1.5 text-blue-400">
                <BrainCircuit className="w-4 h-4" /> Kuis & Pembahasan
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Volume2 className="w-4 h-4" /> Audio Text-to-Speech
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <Sparkles className="w-4 h-4" /> Dynamic Scraper
              </span>
            </div>
          </div>

          <Link
            href="/materi"
            className="w-full md:w-auto px-7 py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <BookOpen className="w-4 h-4 text-amber-300" />
            <span>Jelajahi Bank Materi Now</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 mt-12">
        <p>© 2026 Velocity English Community • MisterGuru Educational Integration.</p>
      </footer>
    </div>
  );
}
