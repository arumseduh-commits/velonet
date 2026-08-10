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
    pathname.startsWith("/admin/bot") || pathname.startsWith("/admin/kick-list");

  // State for collapsible dropdown menu
  const [isBotMenuOpen, setIsBotMenuOpen] = useState(isBotChildActive);

  // Auto-expand dropdown if user navigates to bot control or kick-list
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
    <aside className="w-64 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 flex flex-col justify-between h-full sticky top-0 z-30">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 font-bold text-white text-xl">
              V
            </div>
            <div>
              <h1 className="font-bold text-white tracking-wide text-lg flex items-center gap-1.5">
                Velo<span className="text-blue-400">Net</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Velocity Admin Panel</p>
            </div>
          </div>

          {/* Close button on mobile */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Menu Utama
          </div>

          {/* 1. Overview */}
          <Link
            href="/admin"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
              pathname === "/admin"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-md shadow-blue-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 ${pathname === "/admin" ? "text-blue-400" : "text-slate-400"}`} />
            <span>Overview</span>
          </Link>

          {/* 2. Data Peserta */}
          <Link
            href="/admin/participants"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
              pathname.startsWith("/admin/participants")
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-md shadow-blue-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Users className={`w-5 h-5 ${pathname.startsWith("/admin/participants") ? "text-blue-400" : "text-slate-400"}`} />
            <span>Data Peserta</span>
          </Link>

          {/* 3. Sesi Absensi */}
          <Link
            href="/admin/sessions"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
              pathname.startsWith("/admin/sessions")
                ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-md shadow-emerald-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <CalendarCheck className={`w-5 h-5 ${pathname.startsWith("/admin/sessions") ? "text-emerald-400" : "text-slate-400"}`} />
            <span>Sesi Absensi</span>
          </Link>

          {/* 4. Laporan Kumulatif */}
          <Link
            href="/admin/reports"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
              pathname.startsWith("/admin/reports")
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-md shadow-purple-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <BarChart3 className={`w-5 h-5 ${pathname.startsWith("/admin/reports") ? "text-purple-400" : "text-slate-400"}`} />
            <span>Laporan Kumulatif</span>
          </Link>

          {/* 5. MisterGuru Scraper Hub */}
          <Link
            href="/admin/learning"
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
              pathname.startsWith("/admin/learning")
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-md shadow-blue-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Sparkles className={`w-5 h-5 ${pathname.startsWith("/admin/learning") ? "text-amber-400" : "text-slate-400"}`} />
            <span>MisterGuru Scraper</span>
          </Link>


          {/* 3. Dropdown Parent Menu: Fitur Bot */}
          <div>
            <button
              onClick={() => setIsBotMenuOpen((prev) => !prev)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                isBotChildActive
                  ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Cpu className={`w-5 h-5 ${isBotChildActive ? "text-indigo-400" : "text-slate-400"}`} />
                <span>Fitur Bot</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  isBotMenuOpen ? "rotate-180 text-indigo-400" : "text-slate-400"
                }`}
              />
            </button>

            {/* Sub-menu Dropdown List */}
            {isBotMenuOpen && (
              <div className="mt-1.5 ml-4 pl-3 border-l border-slate-800 space-y-1 transition-all">
                {/* Sub-menu 1: Pusat Kendali Bot */}
                <Link
                  href="/admin/bot"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
                    pathname.startsWith("/admin/bot")
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  <Bot className={`w-4 h-4 ${pathname.startsWith("/admin/bot") ? "text-blue-400" : "text-slate-400"}`} />
                  <span>Pusat Kendali Bot</span>
                </Link>

                {/* Sub-menu 2: Kick List */}
                <Link
                  href="/admin/kick-list"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
                    pathname.startsWith("/admin/kick-list")
                      ? "bg-rose-600/20 text-rose-400 border border-rose-500/30 font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  <UserX className={`w-4 h-4 ${pathname.startsWith("/admin/kick-list") ? "text-rose-400" : "text-slate-400"}`} />
                  <span>Daftar Kick (Keluarkan)</span>
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Footer link to public site & Logout */}
      <div className="p-4 border-t border-slate-800/80 space-y-2">
        <Link
          href="/"
          target="_blank"
          className="flex items-center justify-between p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 text-xs font-medium text-slate-300 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Landing Page
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between p-3 rounded-xl bg-rose-950/20 hover:bg-rose-900/30 border border-rose-500/20 text-xs font-medium text-rose-300 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <LogOut className="w-4 h-4 text-rose-400" />
            Keluar Admin
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
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
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
