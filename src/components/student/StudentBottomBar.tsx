"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Navigation, FileText, User, Camera } from "lucide-react";

export function StudentBottomBar() {
  const pathname = usePathname();

  // Don't render on login, complete-profile, or expired pages
  if (
    pathname === "/student/login" ||
    pathname === "/student/complete-profile" ||
    pathname === "/student/expired"
  ) {
    return null;
  }

  const navItems = [
    {
      href: "/student",
      label: "Beranda",
      icon: LayoutDashboard,
      activeColor: "text-emerald-400",
      activeBg: "bg-emerald-500/15 border-emerald-500/30",
    },
    {
      href: "/student/attendance",
      label: "Absen Wajah",
      icon: Camera,
      activeColor: "text-emerald-400",
      activeBg: "bg-emerald-500/15 border-emerald-500/30",
    },
    {
      href: "/student/profile",
      label: "Profil Saya",
      icon: User,
      activeColor: "text-blue-400",
      activeBg: "bg-blue-500/15 border-blue-500/30",
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-slate-900/95 backdrop-blur-xl border-t border-slate-800/90 px-3 py-2 pb-safe shadow-2xl">
      <div className="grid grid-cols-3 gap-1 max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-200 ${
                isActive
                  ? `${item.activeBg} border font-bold ${item.activeColor} shadow-md`
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : ""}`} />
              <span className="text-[10px] mt-1 tracking-tight truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
