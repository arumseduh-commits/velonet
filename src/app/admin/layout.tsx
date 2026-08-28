"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/Sidebar";
import { AdminHeader } from "@/components/admin/Header";
import { DialogProvider } from "@/components/ui/DialogProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  // If on admin login page (/admin/login), DO NOT render AdminSidebar and AdminHeader!
  if (pathname === "/admin/login") {
    return <DialogProvider>{children}</DialogProvider>;
  }

  return (
    <DialogProvider>
      <div className="flex min-h-screen bg-slate-50 text-slate-900 antialiased">
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
