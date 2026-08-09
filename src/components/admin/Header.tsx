"use client";

import { useEffect, useState } from "react";
import { BotConnectionState } from "@/lib/bot-engine";
import { Bot, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function AdminHeader() {
  const [botState, setBotState] = useState<BotConnectionState>("DISCONNECTED");

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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Bot Connected</span>
          </div>
        );
      case "CONNECTING":
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold animate-pulse">
            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
            <span>Connecting / Scan QR</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>Bot Disconnected</span>
          </div>
        );
    }
  };

  return (
    <header className="h-16 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-slate-300">
          Komunitas Bahasa Inggris <span className="text-blue-400 font-bold">Velocity</span>
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {getStatusBadge()}

        <Link
          href="/admin/bot"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm"
        >
          <Bot className="w-4 h-4" />
          <span>Kelola Bot</span>
        </Link>
      </div>
    </header>
  );
}
