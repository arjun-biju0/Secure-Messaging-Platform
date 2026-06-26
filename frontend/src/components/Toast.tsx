"use client";

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

type ToastKind = "info" | "success" | "error";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastContextValue {
  show: (title: string, description?: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const show = useCallback((title: string, description?: string, kind: ToastKind = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, title, description, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl bg-[#2c2c2e] text-white shadow-lg px-4 py-3 min-w-[260px] max-w-sm"
          >
            <span className="mt-0.5 shrink-0">
              {t.kind === "success" && <CheckCircle2 size={18} className="text-emerald-400" />}
              {t.kind === "error" && <AlertTriangle size={18} className="text-rose-400" />}
              {t.kind === "info" && <Info size={18} className="text-signal-blue" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-snug">{t.title}</p>
              {t.description && (
                <p className="text-xs text-zinc-300 mt-0.5 leading-snug">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-zinc-400 hover:text-white transition-colors"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
