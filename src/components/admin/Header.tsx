"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BotConnectionState } from "@/lib/bot-engine";
import { Bot, RefreshCw, AlertCircle, CheckCircle2, Menu, LogOut } from "lucide-react";
import Link from "next/link";
import { useDialog } from "@/components/ui/DialogProvider";

interface AdminHeaderProps {
  onOpenMobileSidebar?: () => void;
}

export function AdminHeader({ onOpenMobileSidebar }: AdminHeaderProps) {
  const router = useRouter();
  const { confirm, toast } = useDialog();
  const [botState, setBotState] = useState<BotConnectionState>("DISCONNECTED");

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

  useEffect(() => {
    const eventSource = new EventSource("/api/bot/status?stream=true");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "status" && payload.data?.state) {
          setBotState(payload.data.state);
        }
      } catch (err) {
        console.error("Failed to parse SSE status:", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const getStatusBadge = () => {
    switch (botState) {
      case "CONNECTED":
        return (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] sm:text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
            <span className="hidden xs:inline">Bot Connected</span>
            <span className="xs:hidden">Connected</span>
          </div>
        );
      case "CONNECTING":
        return (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] sm:text-xs font-semibold animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 animate-spin" />
            <span>Connecting</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] sm:text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600" />
            <span className="hidden xs:inline">Bot Disconnected</span>
            <span className="xs:hidden">Off</span>
          </div>
        );
    }
  };

  return (
    <header className="h-16 bg-white/85 backdrop-blur-md border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-2.5 sm:gap-3">
        {onOpenMobileSidebar && (
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Buka Menu Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
          Komunitas <span className="text-blue-600 font-bold">Velocity</span>
        </h2>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {getStatusBadge()}

        <Link
          href="/admin/bot"
          className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-xs"
        >
          <Bot className="w-4 h-4" />
          <span className="hidden sm:inline">Kelola Bot</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium transition-colors cursor-pointer"
          title="Keluar dari Admin Dashboard"
        >
          <LogOut className="w-4 h-4 text-rose-600" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}
