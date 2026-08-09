import { AdminSidebar } from "@/components/admin/Sidebar";
import { AdminHeader } from "@/components/admin/Header";
import { DialogProvider } from "@/components/ui/DialogProvider";

export const metadata = {
  title: "Admin Dashboard - Velocity WhatsApp Bot",
  description: "Management portal for Velocity English WhatsApp Bot and Participant Registration",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DialogProvider>
      <div className="flex min-h-screen bg-[#090d16] text-slate-100 antialiased">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader />
          <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </DialogProvider>
  );
}
