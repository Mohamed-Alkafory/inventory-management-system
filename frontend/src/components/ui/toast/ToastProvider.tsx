import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "../../../lib/cn";
import { ToastContext } from "./toast-context";
import type { ToastApi, ToastOptions, ToastTone } from "./toast-context";

type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
};

const MAX_VISIBLE = 5;

const toneStyles: Record<ToastTone, { icon: ReactNode; bar: string }> = {
  success: { icon: <CheckCircle2 className="size-5 text-success-600" aria-hidden="true" />, bar: "border-l-success-600" },
  error: { icon: <AlertCircle className="size-5 text-danger-600" aria-hidden="true" />, bar: "border-l-danger-600" },
  warning: { icon: <TriangleAlert className="size-5 text-warning-600" aria-hidden="true" />, bar: "border-l-warning-600" },
  info: { icon: <Info className="size-5 text-info-600" aria-hidden="true" />, bar: "border-l-info-600" },
};

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    ({ title, description, tone = "info", duration = 5000 }: ToastOptions) => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      setToasts((current) => [...current, { id, tone, title, description }].slice(-MAX_VISIBLE));
      if (duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), duration));
      }
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, description) => show({ title, description, tone: "success" }),
      error: (title, description) => show({ title, description, tone: "error" }),
      info: (title, description) => show({ title, description, tone: "info" }),
      warning: (title, description) => show({ title, description, tone: "warning" }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-100 flex flex-col items-end gap-2 sm:left-auto sm:w-96"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full items-start gap-3 rounded-card border border-l-4 border-line bg-surface p-4 shadow-overlay animate-toast-in motion-reduce:animate-none",
              toneStyles[t.tone].bar,
            )}
          >
            {toneStyles[t.tone].icon}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="rounded-control p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
