"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  X,
  Trash2,
  ShieldAlert,
  Send,
  HelpCircle,
} from "lucide-react";

export type ModalVariant = "danger" | "warning" | "info" | "success";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ModalVariant;
  icon?: "trash" | "warning" | "info" | "success" | "shield" | "send" | "help";
}

export interface CustomActionOption {
  key: string;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

export interface CustomModalOptions {
  title: string;
  message: string;
  variant?: ModalVariant;
  actions: CustomActionOption[];
}

export interface ToastItem {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
}

interface DialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  customConfirm: (options: CustomModalOptions) => Promise<string | null>;
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    warning: (message: string) => void;
  };
}

const DialogContext = createContext<DialogContextType | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<(ConfirmOptions & { resolve: (val: boolean) => void }) | null>(null);

  // Custom Actions Modal State
  const [customModal, setCustomModal] = useState<(CustomModalOptions & { resolve: (val: string | null) => void }) | null>(null);

  // Toast Notifications State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // 1. Confirm Handler
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModal({
        ...options,
        resolve: (result: boolean) => {
          setConfirmModal(null);
          resolve(result);
        },
      });
    });
  }, []);

  // 2. Custom Multi-Action Modal Handler
  const customConfirm = useCallback((options: CustomModalOptions): Promise<string | null> => {
    return new Promise((resolve) => {
      setCustomModal({
        ...options,
        resolve: (result: string | null) => {
          setCustomModal(null);
          resolve(result);
        },
      });
    });
  }, []);

  // 3. Toast Helper
  const addToast = useCallback((type: "success" | "error" | "info" | "warning", message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    // Auto remove after 4.5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastHelpers = React.useMemo(() => ({
    success: (msg: string) => addToast("success", msg),
    error: (msg: string) => addToast("error", msg),
    info: (msg: string) => addToast("info", msg),
    warning: (msg: string) => addToast("warning", msg),
  }), [addToast]);

  const contextValue = React.useMemo(() => ({
    confirm,
    customConfirm,
    toast: toastHelpers,
  }), [confirm, customConfirm, toastHelpers]);

  const getModalIcon = (iconName?: string, variant: ModalVariant = "warning") => {
    if (iconName === "trash") return <Trash2 className="w-6 h-6 text-rose-600" />;
    if (iconName === "shield") return <ShieldAlert className="w-6 h-6 text-amber-600" />;
    if (iconName === "send") return <Send className="w-6 h-6 text-blue-600" />;
    if (iconName === "help") return <HelpCircle className="w-6 h-6 text-emerald-600" />;

    switch (variant) {
      case "danger":
        return <AlertTriangle className="w-6 h-6 text-rose-600" />;
      case "warning":
        return <AlertTriangle className="w-6 h-6 text-amber-600" />;
      case "info":
        return <Info className="w-6 h-6 text-blue-600" />;
      case "success":
        return <CheckCircle2 className="w-6 h-6 text-emerald-600" />;
    }
  };

  const getHeaderBg = (variant: ModalVariant = "warning") => {
    switch (variant) {
      case "danger":
        return "bg-rose-50 border-rose-200 text-rose-600";
      case "warning":
        return "bg-amber-50 border-amber-200 text-amber-600";
      case "info":
        return "bg-blue-50 border-blue-200 text-blue-600";
      case "success":
        return "bg-emerald-50 border-emerald-200 text-emerald-600";
    }
  };

  const getConfirmBtnStyle = (variant: ModalVariant = "warning") => {
    switch (variant) {
      case "danger":
        return "bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20";
      case "warning":
        return "bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-500/20";
      case "info":
        return "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20";
      case "success":
        return "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20";
    }
  };

  return (
    <DialogContext.Provider value={contextValue}>
      {children}

      {/* --- CONFIRMATION MODAL --- */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-200 scale-100"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-xl border flex-shrink-0 ${getHeaderBg(
                    confirmModal.variant
                  )}`}
                >
                  {getModalIcon(confirmModal.icon, confirmModal.variant)}
                </div>
                <div className="space-y-1 pt-0.5">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    {confirmModal.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {confirmModal.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => confirmModal.resolve(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                >
                  {confirmModal.cancelText || "Batal"}
                </button>
                <button
                  type="button"
                  onClick={() => confirmModal.resolve(true)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer ${getConfirmBtnStyle(
                    confirmModal.variant
                  )}`}
                >
                  {confirmModal.confirmText || "Ya, Lanjutkan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM MULTI-ACTION MODAL --- */}
      {customModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-xl border flex-shrink-0 ${getHeaderBg(
                    customModal.variant
                  )}`}
                >
                  {getModalIcon(undefined, customModal.variant)}
                </div>
                <div className="space-y-1 pt-0.5">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    {customModal.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {customModal.message}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                {customModal.actions.map((act) => {
                  let btnStyle =
                    "px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full sm:w-auto text-center ";
                  if (act.variant === "primary") {
                    btnStyle += "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20";
                  } else if (act.variant === "danger") {
                    btnStyle += "bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20";
                  } else if (act.variant === "secondary") {
                    btnStyle += "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300";
                  } else {
                    btnStyle += "bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900";
                  }

                  return (
                    <button
                      key={act.key}
                      type="button"
                      onClick={() => customModal.resolve(act.key)}
                      className={btnStyle}
                    >
                      {act.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TOAST NOTIFICATIONS CONTAINER --- */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 p-4 rounded-xl bg-white border border-slate-200 text-slate-800 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300"
          >
            {t.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />}
            {t.type === "error" && <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />}
            {t.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />}
            {t.type === "info" && <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />}

            <div className="flex-1 text-xs leading-relaxed font-medium">
              {t.message}
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return ctx;
}
