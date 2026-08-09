"use client";

import React from "react";
import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentBottomBar } from "@/components/student/StudentBottomBar";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-emerald-500 selection:text-white flex flex-col justify-between">
      <StudentHeader />
      <main className="flex-1 w-full">{children}</main>
      <StudentBottomBar />
    </div>
  );
}
