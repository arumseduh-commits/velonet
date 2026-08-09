"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/Sidebar";
import { AdminHeader } from "@/components/admin/Header";
import { DialogProvider } from "@/components/ui/DialogProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <DialogProvider>
      <div className="flex min-h-screen bg-[#090d16] text-slate-100 antialiased">
        <AdminSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          />
          <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </DialogProvider>
  );
}
