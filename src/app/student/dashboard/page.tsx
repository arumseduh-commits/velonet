"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function StudentDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/student");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col items-center justify-center text-slate-400 gap-3">
      <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
      <span className="text-sm font-medium">Mengarahkan ke Dashboard Siswa...</span>
    </div>
  );
}
