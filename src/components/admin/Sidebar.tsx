"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserX,
  Bot,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Cpu,
  CalendarCheck,
  BarChart3,
  X,
  LogOut,
  Camera,
  BookOpen,
  FolderKanban,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface AdminSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ isOpen = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { confirm, toast } = useDialog();

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: "Keluar dari Admin Dashboard",
      message: "Apakah Anda yakin ingin keluar dari sesi Admin?",
      confirmText: "Ya, Keluar",
      cancelText: "Batal",
      variant: "danger",
      icon: "warning",
    });

    if (!confirmed) return;

    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      toast.info("Anda telah keluar dari Admin Dashboard.");
      router.push("/admin/login");
    } catch (e) {
      router.push("/admin/login");
    }
  };

  // Check if any sub-item of "Fitur Bot" is active
  const isBotChildActive =
    pathname.startsWith("/admin/bot") ||
    pathname.startsWith("/admin/kick-list") ||
    pathname.startsWith("/admin/exclusions");

  // State for collapsible dropdown menu
  const [isBotMenuOpen, setIsBotMenuOpen] = useState(isBotChildActive);

  // Auto-expand dropdown if user navigates to bot control, kick-list, or exclusions
  useEffect(() => {
    if (isBotChildActive) {
      setIsBotMenuOpen(true);
    }
  }, [pathname, isBotChildActive]);

  // Auto-close mobile drawer on route change
  useEffect(() => {
    if (onClose) onClose();
  }, [pathname]);

  const navContent = (
    <aside className="w-64 bg-white border-r border-slate-200 shadow-xs flex flex-col justify-between h-full sticky top-0 z-30 overflow-y-auto">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20 font-black text-white text-xl">
              V
            </div>
            <div>
              <h1 className="font-black text-slate-900 tracking-tight text-lg flex items-center gap-1">
                Velo<span className="text-blue-600">Net</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                LMS & Community
              </p>
            </div>
          </div>

          {/* Close button on mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-4">
          {/* SECTION 1: CORE */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Utama
            </div>
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-xs transition-all ${
                pathname === "/admin"
                  ? "bg-blue-50 text-blue-700 font-bold border border-blue-200/80 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 ${pathname === "/admin" ? "text-blue-600" : "text-slate-400"}`} />
              <span>Overview Dashboard</span>
            </Link>
          </div>

          {/* SECTION 2: LMS & PEMBELAJARAN */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              LMS & Pembelajaran
            </div>
            <Link
              href="/admin/learning"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-xs transition-all ${
                pathname.startsWith("/admin/learning")
                  ? "bg-blue-50 text-blue-700 font-bold border border-blue-200/80 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Sparkles className={`w-4 h-4 ${pathname.startsWith("/admin/learning") ? "text-amber-500" : "text-slate-400"}`} />
              <span>AI Quiz Assistant</span>
            </Link>

            <Link
              href="/admin/courses"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-xs transition-all ${
                pathname.startsWith("/admin/courses")
                  ? "bg-blue-50 text-blue-700 font-bold border border-blue-200/80 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <FolderKanban className={`w-4 h-4 ${pathname.startsWith("/admin/courses") ? "text-blue-600" : "text-slate-400"}`} />
              <span>Katalog Kursus & Modul</span>
            </Link>

            <Link
              href="/admin/exams"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-xs transition-all ${
                pathname.startsWith("/admin/exams")
                  ? "bg-blue-50 text-blue-700 font-bold border border-blue-200/80 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <ShieldAlert className={`w-4 h-4 ${pathname.startsWith("/admin/exams") ? "text-rose-600" : "text-slate-400"}`} />
              <span>VeloExambro CBT</span>
            </Link>
          </div>

          {/* SECTION 3: PRESENSI & SESI */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Presensi & Sesi
            </div>
            <Link
              href="/admin/sessions"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-xs transition-all ${
                pathname.startsWith("/admin/sessions")
                  ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/80 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <CalendarCheck className={`w-4 h-4 ${pathname.startsWith("/admin/sessions") ? "text-emerald-600" : "text-slate-400"}`} />
              <span>Sesi Absensi Pertemuan</span>
            </Link>

            <Link
              href="/admin/face-terminal"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-xs transition-all ${
                pathname.startsWith("/admin/face-terminal")
                  ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/80 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Camera className={`w-4 h-4 ${pathname.startsWith("/admin/face-terminal") ? "text-emerald-600" : "text-slate-400"}`} />
              <span>Terminal Wajah (Kiosk)</span>
            </Link>

            <Link
              href="/admin/reports"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-xs transition-all ${
                pathname.startsWith("/admin/reports")
                  ? "bg-purple-50 text-purple-700 font-bold border border-purple-200/80 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <BarChart3 className={`w-4 h-4 ${pathname.startsWith("/admin/reports") ? "text-purple-600" : "text-slate-400"}`} />
              <span>Laporan Kumulatif</span>
            </Link>
          </div>

          {/* SECTION 4: KOMUNITAS & BOT */}
          <div className="space-y-1">
            <div className="px-3 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Komunitas & Bot WA
            </div>
            <Link
              href="/admin/participants"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl font-semibold text-xs transition-all ${
                pathname.startsWith("/admin/participants")
                  ? "bg-blue-50 text-blue-700 font-bold border border-blue-200/80 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Users className={`w-4 h-4 ${pathname.startsWith("/admin/participants") ? "text-blue-600" : "text-slate-400"}`} />
              <span>Data Peserta</span>
            </Link>

            {/* Dropdown Menu: Fitur Bot */}
            <div>
              <button
                onClick={() => setIsBotMenuOpen((prev) => !prev)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold text-xs transition-all cursor-pointer ${
                  isBotChildActive
                    ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Cpu className={`w-4 h-4 ${isBotChildActive ? "text-indigo-600" : "text-slate-400"}`} />
                  <span>Fitur Bot WA</span>
                </div>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isBotMenuOpen ? "rotate-180 text-indigo-600" : "text-slate-400"
                  }`}
                />
              </button>

              {isBotMenuOpen && (
                <div className="mt-1 ml-4 pl-3 border-l border-slate-200 space-y-1">
                  <Link
                    href="/admin/bot"
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      pathname.startsWith("/admin/bot")
                        ? "bg-blue-50 text-blue-700 font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5 text-blue-600" />
                    <span>Pusat Kendali Bot</span>
                  </Link>

                  <Link
                    href="/admin/kick-list"
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      pathname.startsWith("/admin/kick-list")
                        ? "bg-rose-50 text-rose-700 font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <UserX className="w-3.5 h-3.5 text-rose-600" />
                    <span>Daftar Kick (Opt-Out)</span>
                  </Link>

                  <Link
                    href="/admin/exclusions"
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      pathname.startsWith("/admin/exclusions")
                        ? "bg-amber-50 text-amber-700 font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-600" />
                    <span>Exclusion List</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </nav>
      </div>

      {/* Footer link to public site & Logout */}
      <div className="p-3 border-t border-slate-200 space-y-2">
        <Link
          href="/"
          target="_blank"
          className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Portal Depan</span>
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-semibold text-rose-700 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <LogOut className="w-4 h-4 text-rose-600" />
            <span>Keluar Admin</span>
          </span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-screen sticky top-0 z-30">
        {navContent}
      </div>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={onClose}
          />
          <div className="relative z-10 h-full animate-in slide-in-from-left duration-300">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
