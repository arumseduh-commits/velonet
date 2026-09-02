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
  ShieldAlert,
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

  // Don't render header on login, complete-profile, expired, or full-camera / CBT exam runner pages
  if (
    pathname === "/student/login" ||
    pathname === "/student/complete-profile" ||
    pathname === "/student/expired" ||
    pathname === "/student/attendance" ||
    pathname.startsWith("/student/quiz") ||
    pathname.startsWith("/student/face-register")
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
      href: "/student/exams",
      label: "Ujian CBT",
      icon: ShieldAlert,
      isActive: pathname.startsWith("/student/exams"),
    },
    {
      href: "/student/learning",
      label: "Materi LMS",
      icon: BookOpen,
      isActive: pathname.startsWith("/student/learning"),
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
    <header className="h-16 bg-white/85 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Brand / Profile Info */}
      <div className="flex items-center gap-3">
        <Link href="/student" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center font-extrabold text-white text-base shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            {student?.name?.charAt(0).toUpperCase() || "S"}
          </div>
          <div>
            <span className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
              <span className="truncate max-w-[150px] sm:max-w-[200px]">{student?.name || "Portal Siswa"}</span>
              {student?.studentClass && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {student.studentClass}
                </span>
              )}
            </span>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              Komunitas Velocity
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold btn-press transition-all ${
                item.isActive
                  ? "bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent"
              }`}
            >
              <Icon className={`w-4 h-4 ${item.isActive ? "text-emerald-600" : "text-slate-500"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right: Logout Button */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 border border-slate-200 text-xs font-semibold btn-press transition-all cursor-pointer"
          title="Keluar dari Portal Siswa"
        >
          <LogOut className="w-4 h-4 text-rose-500" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}
