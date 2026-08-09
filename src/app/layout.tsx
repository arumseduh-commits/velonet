import "./globals.css";
import type { Metadata } from "next";

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
    <html lang="id" className="dark">
      <body className="bg-[#090d16] text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
