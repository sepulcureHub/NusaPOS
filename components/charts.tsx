"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Category } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/types";
import { compact, compactRp, num, rupiah } from "@/lib/format";
import type { DayPoint } from "@/lib/analytics";
import { HOURS, WEEKDAYS } from "@/lib/analytics";

function niceCeil(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v))));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
}

function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  const r = (n: number) => Math.round(n * 10) / 10;
  let d = `M ${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${r(p1[0] + (p2[0] - p0[0]) / 6)} ${r(p1[1] + (p2[1] - p0[1]) / 6)} ${r(p2[0] - (p3[0] - p1[0]) / 6)} ${r(p2[1] - (p3[1] - p1[1]) / 6)} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d;
}

/* ---------- Sparkline ---------- */
export function Sparkline({ data, color = "var(--accent)", width = 96, height = 30 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const id = useId().replace(/[:]/g, "");
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * width},${height - 3 - (v / max) * (height - 6)}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".3" /><stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts.join(" ")} ${width},${height}`} fill={`url(#sp${id})`} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Area / Line ---------- */
export function AreaChart({ data, compare, height = 260, color = "var(--accent)" }: {
  data: DayPoint[]; compare?: DayPoint[]; height?: number; color?: string;
}) {
  const id = useId().replace(/[:]/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 800, H = height, P = { l: 48, r: 14, t: 16, b: 26 };
  const max = niceCeil(Math.max(1, ...data.map((d) => d.value), ...(compare ?? []).map((d) => d.value)));
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / max);
  const line = smoothPath(data.map((d, i) => [x(i), y(d.value)]));
  const area = `${line} L ${x(data.length - 1)} ${H - P.b} L ${x(0)} ${H - P.b} Z`;
  const cmpLine = compare ? smoothPath(compare.map((d, i) => [x(i), y(d.value)])) : "";
  const every = Math.ceil(data.length / 6);

  const move = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const px = ((clientX - rect.left) / rect.width) * W;
    const step = (W - P.l - P.r) / Math.max(1, data.length - 1);
    setHover(Math.min(data.length - 1, Math.max(0, Math.round((px - P.l) / step))));
  };

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full block" style={{ height: "auto" }}
        onMouseMove={(e) => move(e.clientX)} onMouseLeave={() => setHover(null)}
        onTouchMove={(e) => move(e.touches[0].clientX)} onTouchEnd={() => setHover(null)}>
        <defs>
          <linearGradient id={`ar${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity=".02" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line x1={P.l} x2={W - P.r} y1={y((max * k) / 4)} y2={y((max * k) / 4)} stroke="var(--line)" strokeDasharray={k === 0 ? "" : "3 5"} />
            <text x={P.l - 8} y={y((max * k) / 4) + 3} textAnchor="end" fontSize="10" fill="var(--faint)">{compact((max * k) / 4)}</text>
          </g>
        ))}
        {data.map((d, i) => i % every === 0 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--faint)">{d.label}</text>
        ) : null)}
        <path d={area} fill={`url(#ar${id})`} className="anim-fade" style={{ animationDelay: ".35s", animationDuration: ".7s" }} />
        {compare && <path d={cmpLine} fill="none" stroke="var(--violet)" strokeWidth="2" strokeDasharray="5 6" className="anim-fade" style={{ animationDelay: ".3s" }} />}
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" pathLength={1} strokeDasharray="1" strokeDashoffset="1"
          style={{ animation: "draw 1.1s .1s cubic-bezier(.4,0,.2,1) forwards" }} />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="var(--line2)" />
            {compare && <circle cx={x(hover)} cy={y(compare[hover]?.value ?? 0)} r="4" fill="var(--violet)" stroke="var(--bg2)" strokeWidth="2" />}
            <circle cx={x(hover)} cy={y(data[hover].value)} r="5" fill={color} stroke="var(--bg2)" strokeWidth="2.5" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `clamp(80px, ${(x(hover) / W) * 100}%, calc(100% - 80px))`, top: `${(y(data[hover].value) / H) * 100}%` }}>
          <p className="font-bold text-ink">{data[hover].full}</p>
          <p className="font-mono font-bold" style={{ color }}>{rupiah(data[hover].value)}</p>
          <p className="text-mute">{data[hover].count} transaksi • {data[hover].items} item</p>
          {compare && <p className="text-violet">Sebelumnya: {rupiah(compare[hover]?.value ?? 0)}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- Donut ---------- */
export function Donut({ data, size = 190, thick = 24, centerTitle = "Total" }: {
  data: { label: string; value: number; color: string }[]; size?: number; thick?: number; centerTitle?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => { const r = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(r); }, []);
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = (size - thick - 8) / 2;
  let acc = 0;
  const segs = data.map((d, i) => {
    const pct = total > 0 ? (d.value / total) * 100 : 0;
    const el = (
      <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color}
        strokeWidth={hover === i ? thick + 6 : thick} pathLength={100}
        strokeDasharray={on ? `${Math.max(0, pct - 1)} ${100 - pct + 1}` : "0 100"}
        strokeDashoffset={25 - acc - 0.5}
        style={{ transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1), stroke-width .2s", cursor: "pointer" }}
        onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
    );
    acc += pct;
    return el;
  });
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={thick} />
          {segs}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
          <div>
            <p className="text-[10px] font-bold text-faint uppercase tracking-wider">{h ? h.label : centerTitle}</p>
            <p className="font-display font-bold text-lg" style={{ color: h ? h.color : "var(--text)" }}>
              {h ? `${((h.value / Math.max(1, total)) * 100).toFixed(1)}%` : compactRp(total)}
            </p>
          </div>
        </div>
      </div>
      <ul className="flex-1 w-full space-y-1.5">
        {data.map((d, i) => (
          <li key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 cursor-default transition-colors"
            style={{ background: hover === i ? "var(--surface2)" : "transparent" }}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="font-semibold flex-1 truncate">{d.label}</span>
            <span className="text-faint">{((d.value / Math.max(1, total)) * 100).toFixed(0)}%</span>
            <span className="font-mono font-bold text-mute">{compactRp(d.value)}</span>
          </li>
        ))}
        {data.length === 0 && <li className="text-xs text-faint text-center py-4">Belum ada data</li>}
      </ul>
    </div>
  );
}

/* ---------- Bars per jam ---------- */
export function Bars({ data, height = 220, color = "var(--accent)" }: {
  data: { label: string; value: number; revenue: number }[]; height?: number; color?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800, H = height, P = { l: 30, r: 10, t: 20, b: 24 };
  const max = niceCeil(Math.max(1, ...data.map((d) => d.value)));
  const step = (W - P.l - P.r) / data.length;
  const bw = step * 0.58;
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / max);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
        {[0, 1, 2].map((k) => (
          <g key={k}>
            <line x1={P.l} x2={W - P.r} y1={y((max * k) / 2)} y2={y((max * k) / 2)} stroke="var(--line)" strokeDasharray={k === 0 ? "" : "3 5"} />
            <text x={P.l - 6} y={y((max * k) / 2) + 3} textAnchor="end" fontSize="10" fill="var(--faint)">{compact((max * k) / 2)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const bx = P.l + i * step + (step - bw) / 2;
          const bh = Math.max(0, H - P.b - y(d.value));
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={P.l + i * step} y={P.t} width={step} height={H - P.t - P.b} fill="transparent" />
              <rect x={bx} y={y(d.value)} width={bw} height={bh} rx="4"
                fill={hover === i ? "var(--amber)" : color} opacity={hover === null || hover === i ? 1 : 0.45}
                className="bar-grow" style={{ animationDelay: `${i * 25}ms`, transition: "fill .15s, opacity .15s" }} />
              {hover === i && <text x={bx + bw / 2} y={y(d.value) - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--amber)">{d.value}</text>}
              <text x={bx + bw / 2} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--faint)">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `clamp(90px, ${((P.l + hover * step + step / 2) / W) * 100}%, calc(100% - 90px))`, top: `${(y(data[hover].value) / H) * 100}%` }}>
          <p className="font-bold">{data[hover].label}.00–{Number(data[hover].label) + 1}.00</p>
          <p className="text-mute">{data[hover].value} transaksi • {compactRp(data[hover].revenue)}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Heatmap hari × jam ---------- */
export function Heatmap({ matrix }: { matrix: number[][] }) {
  const max = Math.max(1, ...matrix.flat());
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `36px repeat(${HOURS.length}, minmax(0,1fr))` }}>
          <span />
          {HOURS.map((h) => <span key={h} className="text-[9px] text-faint text-center font-mono">{h}</span>)}
          {WEEKDAYS.map((d, r) => (
            <FragmentRow key={d} label={d} row={matrix[r]} max={max} />
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 text-[10px] text-faint">
          <span>Sepi</span>
          <span className="h-2 flex-1 max-w-[140px] rounded-full" style={{ background: "linear-gradient(90deg, var(--surface2), var(--accent))" }} />
          <span>Ramai</span>
          <span className="ml-auto">maks {max} trx / jam</span>
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ label, row, max }: { label: string; row: number[]; max: number }) {
  return (
    <>
      <span className="text-[10px] text-mute font-bold flex items-center">{label}</span>
      {row.map((v, c) => (
        <div key={c} title={`${label} ${HOURS[c]}.00 — ${v} transaksi`}
          className="h-[18px] rounded-[4px] transition-transform hover:scale-110 hover:ring-1 hover:ring-accent cursor-default"
          style={{ background: v > 0 ? `color-mix(in srgb, var(--accent) ${Math.round(10 + 90 * Math.sqrt(v / max))}%, var(--surface2))` : "var(--surface2)", opacity: v > 0 ? 1 : 0.5 }} />
      ))}
    </>
  );
}

/* ---------- Top produk ---------- */
export function HBarList({ items }: { items: { name: string; emoji: string; category: Category; qty: number; revenue: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.revenue));
  return (
    <ul className="space-y-3">
      {items.map((p, i) => {
        const c = CATEGORY_COLORS[p.category];
        return (
          <li key={p.name} className="flex items-center gap-3 rise" style={{ animationDelay: `${i * 60}ms` }}>
            <span className="w-5 text-center font-mono text-xs text-faint">{i + 1}</span>
            <span className="text-xl">{p.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-bold truncate">{p.name}</p>
                <p className="text-[11px] font-mono text-mute shrink-0">{compactRp(p.revenue)} <span className="text-faint">×{num(p.qty)}</span></p>
              </div>
              <div className="h-2 rounded-full bg-surface2 mt-1.5 overflow-hidden">
                <div className="h-full rounded-full bar-grow-x" style={{ width: `${(p.revenue / max) * 100}%`, background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 55%, var(--surface2)))`, animationDelay: `${i * 70}ms` }} />
              </div>
            </div>
          </li>
        );
      })}
      {items.length === 0 && <li className="text-xs text-faint text-center py-6">Belum ada penjualan</li>}
    </ul>
  );
}

/* ---------- Split metode bayar ---------- */
export function PaymentSplit({ data }: { data: { method: string; value: number; count: number; color: string }[] }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-surface2">
        {data.map((d) => d.value > 0 && (
          <div key={d.method} title={`${d.method}: ${rupiah(d.value)}`}
            style={{ width: `${Math.max(2, (d.value / Math.max(1, total)) * 100)}%`, background: d.color, transition: "width .6s" }} />
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        {data.map((d) => (
          <li key={d.method} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
            <span className="font-bold flex-1">{d.method}</span>
            <span className="text-faint">{d.count} trx</span>
            <span className="text-faint w-10 text-right">{((d.value / Math.max(1, total)) * 100).toFixed(0)}%</span>
            <span className="font-mono font-bold text-mute w-20 text-right">{compactRp(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}