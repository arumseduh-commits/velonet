import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@whiskeysockets/baileys", "pino"],
  experimental: {
    // Enable optional features if needed
  },
};

export default nextConfig;
