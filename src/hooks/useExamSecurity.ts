"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface ExamSecurityOptions {
  enabled: boolean;
  enableFullscreenLock?: boolean;
  enableTabSwitchDetect?: boolean;
  enableDevToolsDetect?: boolean;
  onViolation: (type: string, description: string) => void;
}

export function useExamSecurity({
  enabled,
  enableFullscreenLock = true,
  enableTabSwitchDetect = true,
  enableDevToolsDetect = true,
  onViolation,
}: ExamSecurityOptions) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const violationCooldownRef = useRef<{ [key: string]: number }>({});

  const reportViolation = useCallback(
    (type: string, description: string, cooldownMs = 2000) => {
      if (!enabled) return;
      const now = Date.now();
      const lastTime = violationCooldownRef.current[type] || 0;
      if (now - lastTime > cooldownMs) {
        violationCooldownRef.current[type] = now;
        onViolation(type, description);
      }
    },
    [enabled, onViolation]
  );

  // 1. Fullscreen helper
  const enterFullscreen = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      } else if ((document.documentElement as any).msRequestFullscreen) {
        await (document.documentElement as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
      return true;
    } catch (err) {
      console.warn("[ExamSecurity] Failed to enter fullscreen:", err);
      return false;
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
      setIsFullscreen(false);
    } catch (err) {
      console.warn("[ExamSecurity] Failed to exit fullscreen:", err);
    }
  }, []);

  // 2. Event Listeners for Fullscreen, Tab Switch, and Blur
  useEffect(() => {
    if (!enabled) return;

    // Fullscreen change handler
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull && enableFullscreenLock) {
        reportViolation("FULLSCREEN_EXIT", "Peserta keluar dari mode layar penuh (Fullscreen).");
      }
    };

    // Page Visibility change handler (Tab Switch)
    const handleVisibilityChange = () => {
      if (document.hidden && enableTabSwitchDetect) {
        reportViolation("TAB_SWITCH", "Peserta beralih tab atau membuka aplikasi lain.");
      }
    };

    // Window Blur handler (Application Switch / Split Screen)
    const handleWindowBlur = () => {
      if (enableTabSwitchDetect) {
        reportViolation("TAB_SWITCH", "Peserta mengalihkan fokus dari jendela ujian.");
      }
    };

    // Context menu blocker (Right click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportViolation("UNAUTHORIZED_KEYPRESS", "Aksi klik kanan diblokir demi keamanan ujian.", 4000);
    };

    // Keyboard shortcut blocker
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toUpperCase() : "";
      
      // F12 or Developer tools
      if (
        key === "F12" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(key)) ||
        (e.ctrlKey && ["U", "S", "P"].includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        reportViolation("DEVTOOLS_OPENED", `Pintasan tombol devtools (${e.key}) dilarang.`);
        return false;
      }

      // Copy, Cut, Paste
      if (e.ctrlKey && ["C", "V", "X", "A"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        reportViolation("UNAUTHORIZED_KEYPRESS", `Pintasan clipboard (Ctrl+${key}) dinonaktifkan.`, 3000);
        return false;
      }

      // Print Screen
      if (key === "PRINTSCREEN") {
        e.preventDefault();
        reportViolation("UNAUTHORIZED_KEYPRESS", "Tangkapan layar (PrintScreen) dilarang.");
      }
    };

    // Selection prevention
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      // Allow selection inside inputs/textareas if needed, otherwise block
      if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
        e.preventDefault();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("selectstart", handleSelectStart);

    // Initial fullscreen check
    setIsFullscreen(!!document.fullscreenElement);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("selectstart", handleSelectStart);
    };
  }, [enabled, enableFullscreenLock, enableTabSwitchDetect, reportViolation]);

  // 3. DevTools resize/debugger trap
  useEffect(() => {
    if (!enabled || !enableDevToolsDetect) return;

    let devtoolsOpen = false;
    const threshold = 160;

    const interval = setInterval(() => {
      const widthDiff = window.outerWidth - window.innerWidth > threshold;
      const heightDiff = window.outerHeight - window.innerHeight > threshold;

      if (widthDiff || heightDiff) {
        if (!devtoolsOpen) {
          devtoolsOpen = true;
          reportViolation("DEVTOOLS_OPENED", "Alat pengembang (DevTools/Inspect) terdeteksi terbuka.", 5000);
        }
      } else {
        devtoolsOpen = false;
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [enabled, enableDevToolsDetect, reportViolation]);

  return {
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
