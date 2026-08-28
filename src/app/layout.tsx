import "./globals.css";
import type { Metadata } from "next";
import { Providers } from "@/components/providers/Providers";

export const metadata: Metadata = {
  title: "Velocity English Community - Registration & Management System",
  description:
    "Portal Resmi Pendaftaran dan Pendataan Anggota Komunitas Bahasa Inggris Velocity via WhatsApp Bot Otomatis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
