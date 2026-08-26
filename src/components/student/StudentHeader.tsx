"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Camera,
  Trophy,
  User,
  LogOut,
  Sparkles,
} from "lucide-react";
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

  const navLinks = [
    {
      href: "/student",
      label: "Beranda",
      icon: LayoutDashboard,
      isActive: pathname === "/student" || pathname === "/student/dashboard",
    },
    {
      href: "/student/learning",
      label: "Materi & Kuis",
      icon: BookOpen,
      isActive: pathname.startsWith("/student/learning") || pathname.startsWith("/student/quiz"),
    },
    {
      href: "/student/attendance",
      label: "Absen Wajah",
      icon: Camera,
      isActive: pathname === "/student/attendance",
    },
    {
      href: "/student/leaderboard",
      label: "Leaderboard",
      icon: Trophy,
      isActive: pathname === "/student/leaderboard",
    },
    {
      href: "/student/profile",
      label: "Profil",
      icon: User,
      isActive: pathname === "/student/profile",
    },
  ];

  return (
    <header className="h-16 bg-[#090d16]/90 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Brand / Profile Info */}
      <div className="flex items-center gap-3">
        <Link href="/student" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center font-extrabold text-white text-base shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
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
            <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <span>Velocity English Hub</span>
              <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            </p>
          </div>
        </Link>
      </div>

      {/* Desktop Navigation Links */}
      <nav className="hidden md:flex items-center gap-1">
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                item.isActive
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Icon className={`w-4 h-4 ${item.isActive ? "text-emerald-400" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right: Logout Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/30 hover:border-rose-500/30 hover:text-rose-300 text-slate-300 border border-slate-700/80 text-xs font-medium transition-all cursor-pointer"
          title="Keluar dari Portal Siswa"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}
