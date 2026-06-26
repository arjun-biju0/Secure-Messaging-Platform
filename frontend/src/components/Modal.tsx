"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cx } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, footer, maxWidth = "max-w-md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 fade-in px-4">
      <div
        className={cx(
          "bg-white rounded-2xl shadow-xl w-full flex flex-col max-h-[85vh] overflow-hidden",
          maxWidth
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-signal-border shrink-0">
          <h2 className="text-base font-semibold text-signal-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="text-signal-text-tertiary hover:text-signal-text-primary hover:bg-signal-bg-secondary rounded-full p-1.5 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto signal-scroll flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-signal-border shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
