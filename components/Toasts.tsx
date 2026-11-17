"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { IAlert, ICheckCircle, IInfo, IUndo, IX } from "./icons";
import { uid } from "@/lib/format";
import { useMounted } from "./ui";

interface Toast {
  id: string; msg: string; type: "ok" | "err" | "info";
  actionLabel?: string; onAction?: () => void; dur: number;
}

const Ctx = createContext<{ push: (t: { msg: string; type?: "ok" | "err" | "info"; actionLabel?: string; onAction?: () => void; dur?: number }) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const mounted = useMounted();

  const dismiss = useCallback((id: string) => {
    setList((l) => l.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const push = useCallback((t: { msg: string; type?: "ok" | "err" | "info"; actionLabel?: string; onAction?: () => void; dur?: number }) => {
    const id = uid();
    const dur = t.dur ?? (t.onAction ? 6000 : 3600);
    setList((l) => [...l.slice(-3), { id, msg: t.msg, type: t.type ?? "ok", actionLabel: t.actionLabel, onAction: t.onAction, dur }]);
    timers.current[id] = setTimeout(() => dismiss(id), dur);
  }, [dismiss]);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  const color = { ok: "var(--pandan)", err: "var(--chili)", info: "var(--laut)" };
  const icons = { ok: <ICheckCircle size={17} />, err: <IAlert size={17} />, info: <IInfo size={17} /> };

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      {mounted && createPortal(
        <div className="fixed bottom-24 lg:bottom-6 right-4 left-4 sm:left-auto z-[70] flex flex-col gap-2 items-stretch sm:items-end pointer-events-none">
          {list.map((t) => (
            <div key={t.id} className="pointer-events-auto relative overflow-hidden flex items-center gap-3 rounded-2xl border border-line2 bg-overlay px-4 py-3 shadow-2xl anim-pop sm:min-w-[300px] sm:max-w-[400px]">
              <span style={{ color: color[t.type] }}>{icons[t.type]}</span>
              <p className="text-sm font-semibold flex-1">{t.msg}</p>
              {t.onAction && (
                <button onClick={() => { t.onAction?.(); dismiss(t.id); }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline shrink-0">
                  <IUndo size={13} /> {t.actionLabel ?? "Urungkan"}
                </button>
              )}
              <button aria-label="Tutup" onClick={() => dismiss(t.id)} className="text-faint hover:text-ink shrink-0"><IX size={14} /></button>
              <i className="absolute bottom-0 left-0 h-[2px]" style={{ background: color[t.type], animation: `toastbar ${t.dur}ms linear forwards` }} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast harus di dalam ToastProvider");
  return v;
}