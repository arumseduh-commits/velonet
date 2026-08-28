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
} from "lucide-react";

export function StudentBottomBar() {
  const pathname = usePathname();

  // Don't render on login, complete-profile, expired, or full-camera attendance pages
  if (
    pathname === "/student/login" ||
    pathname === "/student/complete-profile" ||
    pathname === "/student/expired" ||
    pathname === "/student/attendance"
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
      href: "/student/learning",
      label: "Materi",
      icon: BookOpen,
      isActive: pathname.startsWith("/student/learning") || pathname.startsWith("/student/quiz"),
    },
    {
      href: "/student/attendance",
      label: "Absen",
      icon: Camera,
      isActive: pathname === "/student/attendance",
    },
    {
      href: "/student/leaderboard",
      label: "Rank",
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
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/90 backdrop-blur-xl border-t border-slate-200/90 px-2 py-2 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="grid grid-cols-5 gap-1 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = item.isActive;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-emerald-50 border border-emerald-200 font-bold text-emerald-700 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className={`w-4 h-4 transition-transform ${isActive ? "scale-110 text-emerald-600" : "text-slate-400"}`} />
              <span className="text-[10px] mt-1 tracking-tight truncate font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
