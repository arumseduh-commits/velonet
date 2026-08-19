"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles, LayoutDashboard, FileText, User, LogOut, Navigation, Camera } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";

interface StudentProfile {
  name: string;
  studentClass: string;
}

export function StudentHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { confirm, toast } = useDialog();

  const [student, setStudent] = useState<StudentProfile | null>(null);

  useEffect(() => {
    fetch("/api/student/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.student) {
          setStudent(json.data.student);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: "Keluar dari Portal Siswa",
      message: "Apakah Anda yakin ingin keluar dari akun Anda?",
      confirmText: "Ya, Keluar",
      cancelText: "Batal",
      variant: "danger",
      icon: "warning",
    });

    if (!confirmed) return;

    try {
      await fetch("/api/student/auth/logout", { method: "POST" });
      toast.info("Anda telah keluar dari Portal Siswa.");
      router.push("/student/login");
    } catch (e) {
      router.push("/student/login");
    }
  };

  // Don't render header on login, complete-profile, expired, or full-camera attendance pages
  if (
    pathname === "/student/login" ||
    pathname === "/student/complete-profile" ||
    pathname === "/student/expired" ||
    pathname === "/student/attendance"
  ) {
    return null;
  }

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Brand / Profile Info */}
      <div className="flex items-center gap-3">
        <Link href="/student" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center font-extrabold text-white text-base shadow-md shadow-emerald-500/20">
            {student?.name?.charAt(0).toUpperCase() || "S"}
          </div>
          <div>
            <span className="font-extrabold text-sm text-white tracking-tight flex items-center gap-1.5">
              <span>{student?.name || "Portal Siswa"}</span>
              {student?.studentClass && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {student.studentClass}
                </span>
              )}
            </span>
            <p className="text-[10px] text-slate-400 font-medium">Velocity Community</p>
          </div>
        </Link>
      </div>

      {/* Desktop Navigation Links */}
      <nav className="hidden md:flex items-center gap-1">
        <Link
          href="/student"
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            pathname === "/student"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>

        <Link
          href="/student/attendance"
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            pathname === "/student/attendance"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Camera className="w-4 h-4 text-emerald-400" />
          <span>Absensi Wajah</span>
        </Link>

        <Link
          href="/student/profile"
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            pathname === "/student/profile"
              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profil Saya</span>
        </Link>
      </nav>

      {/* Right: Logout Button */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs font-medium transition-colors cursor-pointer"
        title="Keluar dari Portal Siswa"
      >
        <LogOut className="w-4 h-4 text-rose-400" />
        <span className="hidden sm:inline">Keluar</span>
      </button>
    </header>
  );
}
