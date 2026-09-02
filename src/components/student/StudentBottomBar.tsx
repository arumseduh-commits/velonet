"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Camera,
  Trophy,
  User,
  ShieldAlert,
} from "lucide-react";

export function StudentBottomBar() {
  const pathname = usePathname();

  // Don't render on login, complete-profile, expired, full-camera attendance, or CBT exam runner pages
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

  const navItems = [
    {
      href: "/student",
      label: "Beranda",
      icon: LayoutDashboard,
      isActive: pathname === "/student" || pathname === "/student/dashboard",
    },
    {
      href: "/student/exams",
      label: "Ujian",
      icon: ShieldAlert,
      isActive: pathname.startsWith("/student/exams"),
    },
    {
      href: "/student/learning",
      label: "Materi",
      icon: BookOpen,
      isActive: pathname.startsWith("/student/learning"),
    },
    {
      href: "/student/attendance",
      label: "Absen",
      icon: Camera,
      isActive: pathname === "/student/attendance",
    },
    {
      href: "/student/profile",
      label: "Profil",
      icon: User,
      isActive: pathname === "/student/profile",
    },
  ];

  const activeIndex = navItems.findIndex((item) => item.isActive);

  return (
    <nav
      aria-label="Navigasi Bawah Siswa"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/90 backdrop-blur-xl border-t border-slate-200/90 px-3 pt-2 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.06)]"
    >
      <div className="relative max-w-md mx-auto">
        {/* Dynamic Sliding Active Pill Background */}
        {activeIndex !== -1 && (
          <div
            className="absolute top-0 bottom-0 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            style={{
              width: "20%",
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          >
            {/* Top active accent indicator dot */}
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-emerald-600 shadow-xs" />
          </div>
        )}

        <div className="grid grid-cols-5 gap-0 relative z-10">
          {navItems.map((item) => {
            const isActive = item.isActive;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-transform duration-150 active:scale-90 select-none cursor-pointer"
              >
                <div
                  className={`transition-all duration-300 ${
                    isActive
                      ? "-translate-y-0.5 scale-110 text-emerald-600"
                      : "text-slate-400 group-hover:text-slate-600"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`text-[10px] mt-1 tracking-tight truncate transition-colors duration-200 ${
                    isActive
                      ? "font-bold text-emerald-700"
                      : "font-medium text-slate-500 group-hover:text-slate-700"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

