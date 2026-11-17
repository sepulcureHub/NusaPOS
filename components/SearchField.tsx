"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { IClock, IRefresh, ISearch, IX } from "./icons";

/* ---------------------------------------------------------------------------
 * NusaPOS — sistem pencarian terpadu
 * Dipakai oleh: Shell (command palette), Kasir, Katalog Produk, Transaksi,
 * dan pemilih isi paket di ProductForm.
 * ------------------------------------------------------------------------- */

const SIZES = {
  sm: { h: 36, pad: 10, font: 12.5, icon: 14, tile: 24, radius: 12, gap: 8 },
  md: { h: 44, pad: 12, font: 14, icon: 16, tile: 28, radius: 14, gap: 10 },
  lg: { h: 56, pad: 14, font: 15.5, icon: 18, tile: 34, radius: 18, gap: 12 },
} as const;

export type SearchSize = keyof typeof SIZES;

function isTyping(target: EventTarget | null) {
  const n = target as HTMLElement | null;
  if (!n || !n.tagName) return false;
  return n.tagName === "INPUT" || n.tagName === "TEXTAREA" || n.tagName === "SELECT" || n.isContentEditable;
}

export function Highlight({ text, query, className = "" }: { text: string; query: string; className?: string }) {
  const q = query.trim();
  if (!q) return <span className={className}>{text}</span>;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < text.length) {
    const hit = lower.indexOf(needle, i);
    if (hit === -1) { parts.push(text.slice(i)); break; }
    if (hit > i) parts.push(text.slice(i, hit));
    parts.push(
      <span key={k++} style={{
        background: "color-mix(in srgb, var(--accent) 22%, transparent)",
        color: "var(--accent)", borderRadius: 4, padding: "0 2px", fontWeight: 700,
      }}>
        {text.slice(hit, hit + needle.length)}
      </span>
    );
    i = hit + needle.length;
  }
  return <span className={className}>{parts}</span>;
}

export interface SearchFieldProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  size?: SearchSize;
  shortcut?: "/" | "mod+k";
  count?: number | null;
  countLabel?: string;
  loading?: boolean;
  trailing?: ReactNode;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  onEnter?: () => void;
  onEscape?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onHotkey?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    value, onChange, placeholder = "Cari…", size = "md", shortcut, count, countLabel = "hasil",
    loading, trailing, className = "", disabled, autoFocus, ariaLabel, onEnter, onEscape,
    onFocus, onBlur, onHotkey, onKeyDown,
  },
  ref
) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement, []);
  const [focused, setFocused] = useState(false);
  const s = SIZES[size];

  useEffect(() => {
    if (!shortcut) return;
    const h = (e: globalThis.KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const match = shortcut === "/" ? (e.key === "/" && !mod && !isTyping(e.target)) : (mod && e.key.toLowerCase() === "k");
      if (!match) return;
      e.preventDefault();
      inner.current?.focus();
      inner.current?.select();
      onHotkey?.();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [shortcut, onHotkey]);

  const modLabel = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";

  return (
    <div
      className={`relative flex items-center transition-all duration-200 ${disabled ? "opacity-50 pointer-events-none" : ""} ${className}`}
      style={{
        height: s.h,
        padding: `0 ${s.pad}px`,
        gap: s.gap,
        borderRadius: s.radius,
        border: `1px solid ${focused ? "var(--accent)" : "var(--line2)"}`,
        background: "var(--bg2)",
        boxShadow: focused
          ? "0 0 0 4px var(--accent-soft), 0 16px 36px -20px color-mix(in srgb, var(--accent) 70%, transparent)"
          : "0 1px 0 color-mix(in srgb, #ffffff 4%, transparent) inset",
      }}
    >
      <span
        className="grid place-items-center shrink-0 transition-all duration-200"
        style={{
          width: s.tile, height: s.tile, borderRadius: Math.round(s.tile * 0.34),
          background: focused ? "var(--accent-soft)" : "var(--surface2)",
          color: focused ? "var(--accent)" : "var(--faint)",
        }}
      >
        {loading ? <IRefresh size={s.icon} className="spin" /> : <ISearch size={s.icon} />}
      </span>

      <input
        ref={inner}
        type="text"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        aria-label={ariaLabel ?? placeholder}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { setFocused(true); onFocus?.(); }}
        onBlur={() => { setFocused(false); onBlur?.(); }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === "Enter") { e.preventDefault(); onEnter?.(); }
          if (e.key === "Escape") {
            e.preventDefault();
            if (onEscape) onEscape();
            else { onChange(""); inner.current?.blur(); }
          }
        }}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-ink placeholder:text-faint h-full"
        style={{ fontSize: s.font, fontWeight: 500 }}
      />

      <span className="flex items-center gap-1.5 shrink-0">
        {typeof count === "number" && value.trim().length > 0 && (
          <span className="hidden sm:inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
            style={{ color: "var(--accent)", background: "var(--accent-soft)" }}>
            {count} {countLabel}
          </span>
        )}
        {value && (
          <button
            type="button"
            aria-label="Bersihkan pencarian"
            onClick={() => { onChange(""); inner.current?.focus(); }}
            className="grid place-items-center rounded-full transition-colors text-faint hover:text-chili"
            style={{ width: s.tile - 4, height: s.tile - 4, background: "var(--surface2)" }}
          >
            <IX size={s.icon - 2} />
          </button>
        )}
        {!value && shortcut && (
          <span className="kbd hidden sm:inline">{shortcut === "/" ? "/" : `${modLabel} K`}</span>
        )}
        {trailing}
      </span>

      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          left: s.pad, right: s.pad, bottom: 0, height: 2, borderRadius: 2,
          background: "linear-gradient(90deg, var(--accent), var(--laut))",
          transform: focused ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "left",
          opacity: focused ? 1 : 0,
          transition: "transform .35s cubic-bezier(.22,1,.36,1), opacity .2s ease",
        }}
      />
    </div>
  );
});

export function SearchPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div role="listbox" className={`card p-2 anim-pop overflow-hidden ${className}`} style={{ boxShadow: "var(--shadow-pop)" }}>
      {children}
    </div>
  );
}

export function SearchGroup({ label, icon, right }: { label: string; icon?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-2 pt-2 pb-1.5">
      {icon && <span className="text-faint">{icon}</span>}
      <span className="text-[10px] font-bold text-faint uppercase tracking-widest">{label}</span>
      <span className="ml-auto">{right}</span>
    </div>
  );
}

export function SearchEmpty({ query, hint }: { query: string; hint?: string }) {
  return (
    <div className="text-center py-8 px-4">
      <div className="text-3xl mb-2">🔍</div>
      <p className="text-sm font-bold">Tidak ada hasil untuk “{query}”</p>
      <p className="text-[11px] text-faint mt-1">{hint ?? "Coba kata kunci lain, nama produk, SKU, atau ID transaksi."}</p>
    </div>
  );
}

export function SearchFooter({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-2 mt-1 border-t border-line text-[10px] text-faint">
      {children ?? (
        <>
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> navigasi</span>
          <span><span className="kbd">↵</span> buka</span>
          <span><span className="kbd">esc</span> tutup</span>
        </>
      )}
    </div>
  );
}

export function useRecentSearches(scope: string, limit = 6) {
  const key = `nusapos:recent:${scope}`;
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p)) setItems(p.filter((x) => typeof x === "string").slice(0, limit));
      }
    } catch { /* abaikan */ }
  }, [key, limit]);

  const push = useCallback((term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    setItems((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, limit);
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* penuh */ }
      return next;
    });
  }, [key, limit]);

  const clear = useCallback(() => {
    setItems([]);
    try { localStorage.removeItem(key); } catch { /* abaikan */ }
  }, [key]);

  return { items, push, clear };
}

export function RecentSearches({ items, onPick, onClear }: { items: string[]; onPick: (v: string) => void; onClear: () => void }) {
  if (!items.length) return null;
  return (
    <div>
      <SearchGroup
        label="Pencarian terakhir"
        icon={<IClock size={12} />}
        right={<button onClick={onClear} className="text-[10px] font-bold text-faint hover:text-chili">Hapus</button>}
      />
      <div className="flex flex-wrap gap-1.5 px-2 pb-2">
        {items.map((t) => (
          <button key={t} onClick={() => onPick(t)} className="chip !py-1 !px-2.5 !text-[11px]">
            <IClock size={11} /> {t}
          </button>
        ))}
      </div>
    </div>
  );
}