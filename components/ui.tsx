"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, RefObject, TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { IChevronDown, ITrendDown, ITrendUp, IX } from "./icons";
import { Sparkline } from "./charts";
import { pctStr } from "@/lib/format";

/* ---------- hooks ---------- */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

let locks = 0;
function useBodyLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    locks++;
    document.body.style.overflow = "hidden";
    return () => { locks = Math.max(0, locks - 1); if (locks === 0) document.body.style.overflow = ""; };
  }, [open]);
}

function useEsc(open: boolean, cb: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") cb(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, cb]);
}

export function useClickOutside(ref: RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, cb]);
}

export function useCountUp(n: number, dur = 800) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(n); prev.current = n; return;
    }
    const from = prev.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(from + (n - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = n;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n, dur]);
  return v;
}

/* ---------- dasar ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "soft";
  size?: "md" | "sm";
};
export function Button({ variant = "primary", size = "md", className = "", ...rest }: BtnProps) {
  return <button className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`} {...rest} />;
}

export function IconBtn({ label, active, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button aria-label={label} title={label}
      className={`btn-icon ${active ? "text-accent border-accent" : "text-mute"} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...rest }, ref) {
  return <input ref={ref} className={`input ${className}`} {...rest} />;
});

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`input resize-none ${className}`} {...rest} />;
}

export function Select({ value, onChange, options, className = "", label }: {
  value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; className?: string; label?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select aria-label={label} className="input pr-8 cursor-pointer" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <IChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
    </div>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-mute mb-1.5">{label}</label>
      {children}
      {error ? <p className="text-[11px] text-chili mt-1">{error}</p> : hint ? <p className="text-[11px] text-faint mt-1">{hint}</p> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, small }: { checked: boolean; onChange: (v: boolean) => void; label?: string; small?: boolean }) {
  const w = small ? "w-8 h-5" : "w-10 h-6";
  const k = small ? 14 : 20;
  return (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`${w} relative rounded-full transition-colors shrink-0`}
      style={{ background: checked ? "var(--accent)" : "var(--surface2)", border: "1px solid var(--line2)" }}>
      <span className="absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-all"
        style={{ width: k, height: k, left: checked ? `calc(100% - ${k + 2}px)` : 2 }} />
    </button>
  );
}

export function Segmented({ value, onChange, options, className = "" }: {
  value: string; onChange: (v: string) => void; options: { v: string; l: ReactNode }[]; className?: string;
}) {
  return (
    <div className={`inline-flex bg-bg2 border border-line rounded-xl p-1 gap-1 ${className}`}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1.5"
          style={value === o.v ? { background: "var(--accent)", color: "var(--accent-ink)" } : { color: "var(--muted)" }}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}>
      {children}
    </span>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className={`chip ${active ? "chip-on" : ""}`}>{children}</button>;
}

export function EmptyState({ emoji, title, desc, children }: { emoji: string; title: string; desc?: string; children?: ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-4xl mb-3">{emoji}</div>
      <p className="font-display font-bold">{title}</p>
      {desc && <p className="text-sm text-mute mt-1">{desc}</p>}
      {children && <div className="mt-4 flex justify-center gap-2">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skel ${className}`} />;
}

export function PageSkel() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-80" />
    </div>
  );
}

/* ---------- overlay ---------- */
export function Modal({ open, onClose, title, children, footer, wide, z = "z-50" }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean; z?: string;
}) {
  const mounted = useMounted();
  useBodyLock(open);
  useEsc(open, onClose);
  if (!open || !mounted) return null;
  return createPortal(
    <div className={`fixed inset-0 ${z} flex items-end sm:items-center justify-center sm:p-6`}>
      <div className="absolute inset-0 anim-fade" style={{ background: "var(--scrim)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div role="dialog" aria-modal="true"
        className={`relative w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-line bg-bg2 shadow-2xl anim-pop`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <h3 className="font-display font-bold text-base">{title}</h3>
          <IconBtn label="Tutup" onClick={onClose}><IX size={16} /></IconBtn>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Drawer({ open, onClose, title, children, footer, side = "right" }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; side?: "right" | "left";
}) {
  const mounted = useMounted();
  useBodyLock(open);
  useEsc(open, onClose);
  if (!open || !mounted) return null;
  const pos = side === "left"
    ? "inset-y-0 left-0 w-[290px] border-r"
    : "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-3xl border-t md:inset-y-0 md:left-auto md:right-0 md:w-[460px] md:max-h-none md:rounded-none md:border-t-0 md:border-l";
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 anim-fade" style={{ background: "var(--scrim)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div role="dialog" aria-modal="true" className={`absolute ${pos} border-line bg-bg2 shadow-2xl anim-pop flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
          <h3 className="font-display font-bold text-base">{title}</h3>
          <IconBtn label="Tutup" onClick={onClose}><IX size={16} /></IconBtn>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line shrink-0">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Confirm({ open, onClose, onConfirm, title, desc, confirmLabel = "Hapus", danger = true }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; desc: string; confirmLabel?: string; danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} z="z-[60]"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
        </div>
      }>
      <p className="text-sm text-mute">{desc}</p>
    </Modal>
  );
}

/* ---------- statistik ---------- */
export function StatCard({ label, value, fmt, delta, deltaLabel = "vs kemarin", spark, color = "var(--accent)", icon, delay = 0 }: {
  label: string; value: number; fmt: (n: number) => string; delta?: number; deltaLabel?: string;
  spark?: number[]; color?: string; icon: ReactNode; delay?: number;
}) {
  const v = useCountUp(value);
  return (
    <div className="card p-4 rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0"
          style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>{icon}</span>
        <span className="text-xs font-bold text-mute leading-tight">{label}</span>
      </div>
      <p className="font-display font-bold text-xl md:text-2xl mt-3 tabular-nums truncate">{fmt(v)}</p>
      <div className="flex items-end justify-between mt-2 gap-2">
        {delta !== undefined ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold"
            style={{ color: delta > 0 ? "var(--pandan)" : delta < 0 ? "var(--chili)" : "var(--muted)" }}>
            {delta > 0 ? <ITrendUp size={13} /> : delta < 0 ? <ITrendDown size={13} /> : null}
            {pctStr(delta)} <span className="text-faint font-medium hidden sm:inline">{deltaLabel}</span>
          </span>
        ) : <span />}
        {spark && spark.length > 1 && <Sparkline data={spark} color={color} width={84} height={26} />}
      </div>
    </div>
  );
}