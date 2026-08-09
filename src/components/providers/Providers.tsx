"use client";

import React from "react";
import { DialogProvider } from "@/components/ui/DialogProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <DialogProvider>{children}</DialogProvider>;
}
