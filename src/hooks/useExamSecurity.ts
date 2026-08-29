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
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const violationCooldownRef = useRef<{ [key: string]: number }>({});

  // Detect Mobile / iOS / Android Environment
  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent || "";
      const isApple = /iPhone|iPad|iPod/i.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
      const isGoogle = /Android/i.test(ua);
      setIsIOS(isApple);
      setIsAndroid(isGoogle);
    }
  }, []);

  const reportViolation = useCallback(
    (type: string, description: string, cooldownMs = 2500) => {
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
      // On iOS Safari, standard HTML5 requestFullscreen on non-video elements is not supported.
      setIsFullscreen(true);
      return true;
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

  // 2. Cross-Platform Event Listeners (iOS, Android, Windows)
  useEffect(() => {
    if (!enabled) return;

    // Fullscreen change handler (Android & Windows)
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull && enableFullscreenLock && !isIOS) {
        reportViolation("FULLSCREEN_EXIT", "Peserta keluar dari mode layar penuh (Fullscreen) / mengecilkan layar.");
      }
    };

    // Page Visibility change handler (Tab switch / Minimize / Home button on mobile)
    const handleVisibilityChange = () => {
      if (document.hidden && enableTabSwitchDetect) {
        reportViolation("TAB_SWITCH", "Peserta beralih tab browser atau membuka aplikasi lain.");
      }
    };

    // Pagehide handler (Crucial for iOS Safari when switching apps or navigating away)
    const handlePageHide = () => {
      if (enableTabSwitchDetect) {
        reportViolation("TAB_SWITCH", "Peserta meninggalkan halaman ujian / beralih aplikasi.");
      }
    };

    // Window Blur handler (Application Switch / Split Screen / Dual Window / Second Monitor on Desktop)
    const handleWindowBlur = () => {
      if (enableTabSwitchDetect) {
        // Small timeout to ignore natural focus changes inside input/textarea
        setTimeout(() => {
          const activeTag = document.activeElement?.tagName;
          if (activeTag !== "INPUT" && activeTag !== "TEXTAREA") {
            // Window lost focus! This happens when student clicks on split-screen ChatGPT, second monitor, taskbar, or another app
            reportViolation(
              "WINDOW_BLUR",
              "Peserta mengalihkan fokus / klik ke jendela atau aplikasi lain (Split Screen / Dual Window terdeteksi)."
            );
          }
        }, 120);
      }
    };

    // Window Resize / Split Screen Snap Detection on Desktop/Laptop
    const handleResize = () => {
      if (!isIOS && !isAndroid && enableFullscreenLock) {
        // If width or height is significantly smaller than screen dimensions and not fullscreen
        const isNotFull = !document.fullscreenElement;
        const isSplitWindow = window.innerWidth < window.screen.availWidth * 0.85 || window.innerHeight < window.screen.availHeight * 0.80;

        if (isNotFull && isSplitWindow) {
          reportViolation(
            "SPLIT_SCREEN",
            "Layar terdeteksi dibagi (Split Screen / Snap Window). Ujian wajib dikerjakan dalam mode layar penuh (Fullscreen)."
          );
        }
      }
    };

    // Context menu blocker (Right click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportViolation("UNAUTHORIZED_KEYPRESS", "Aksi klik kanan diblokir demi keamanan ujian.", 4000);
    };

    // Keyboard shortcut blocker (Ctrl+C, Ctrl+V, F12, DevTools, Inspect)
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

      // Windows key or Alt key combinations (e.g. Alt+Tab, Win+Arrow for split screen)
      if (e.altKey && ["TAB", "ARROWLEFT", "ARROWRIGHT", "ESCAPE"].includes(key)) {
        e.preventDefault();
        reportViolation("UNAUTHORIZED_KEYPRESS", "Pintasan beralih jendela (Alt+Tab / Snap) dilarang.");
        return false;
      }

      // Copy, Cut, Paste, Select All
      if (e.ctrlKey && ["C", "V", "X", "A"].includes(key)) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          e.stopPropagation();
          reportViolation("UNAUTHORIZED_KEYPRESS", `Pintasan clipboard (Ctrl+${key}) dinonaktifkan.`, 3000);
          return false;
        }
      }

      // Print Screen
      if (key === "PRINTSCREEN") {
        e.preventDefault();
        reportViolation("UNAUTHORIZED_KEYPRESS", "Tangkapan layar (PrintScreen) dilarang.");
      }
    };

    // Selection prevention outside form inputs
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
        e.preventDefault();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("resize", handleResize);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("selectstart", handleSelectStart);

    // Initial fullscreen state check
    setIsFullscreen(!!document.fullscreenElement);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("selectstart", handleSelectStart);
    };
  }, [enabled, enableFullscreenLock, enableTabSwitchDetect, isIOS, isAndroid, reportViolation]);

  // 3. DevTools resize/debugger trap on desktop
  useEffect(() => {
    if (!enabled || !enableDevToolsDetect || isIOS || isAndroid) return;

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
  }, [enabled, enableDevToolsDetect, isIOS, isAndroid, reportViolation]);

  return {
    isFullscreen,
    isIOS,
    isAndroid,
    enterFullscreen,
    exitFullscreen,
  };
}
