"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Category } from "@/lib/types";
import { CATEGORY_COLORS } from "@/lib/types";
import { compact, compactRp, num, rupiah } from "@/lib/format";
import type { DayPoint } from "@/lib/analytics";
import { HOURS, WEEKDAYS } from "@/lib/analytics";

/* ══════════════════════════════════════════════════════════════════════════
   NusaPOS — chart primitives.
   Tanpa library eksternal: SVG + CSS vars dari design system aplikasi.
   Semua perhitungan turunan bersifat murni (tidak ada reassign variabel
   render-scope di dalam callback), aman untuk React 19 + aturan hooks.
   ══════════════════════════════════════════════════════════════════════════ */

const SERIES_HUES = [
  "var(--accent)",
  "var(--amber)",
  "var(--violet)",
  "var(--laut)",
  "var(--pandan)",
  "var(--magenta)",
  "var(--chili)",
  "var(--muted)",
];

const CHART_CSS = `
.nusa-scroll{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--accent) 55%,var(--line)) transparent}
.nusa-scroll::-webkit-scrollbar{height:9px;width:9px}
.nusa-scroll::-webkit-scrollbar-track{background:var(--surface2);border-radius:99px;border:1px solid var(--line)}
.nusa-scroll::-webkit-scrollbar-thumb{border-radius:99px;border:2px solid var(--surface2);background:linear-gradient(90deg,var(--accent),var(--laut))}
.nusa-scroll::-webkit-scrollbar-thumb:hover{background:linear-gradient(90deg,var(--accent),var(--amber))}
.nusa-chart:focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:14px}
.nusa-hit{cursor:pointer}
.nusa-hit:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:8px}
@media (prefers-reduced-motion: reduce){
  .nusa-anim,.nusa-anim *{animation:none!important;transition:none!important}
}
`;

function ChartStyles() {
  return <style>{CHART_CSS}</style>;
}

function niceCeil(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v))));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
}

function smoothPath(pts: [number, number][]) {
  if (pts.length === 0) return "";
  const r = (n: number) => Math.round(n * 10) / 10;
  if (pts.length === 1) return `M ${r(pts[0][0])} ${r(pts[0][1])}`;
  let d = `M ${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${r(p1[0] + (p2[0] - p0[0]) / 6)} ${r(p1[1] + (p2[1] - p0[1]) / 6)} ${r(p2[0] - (p3[0] - p1[0]) / 6)} ${r(p2[1] - (p3[1] - p1[1]) / 6)} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d;
}

/** Prefiks kumulatif murni — pengganti akumulator yang di-reassign saat render. */
function cumulative(values: number[]): number[] {
  return values.map((_, i) => values.slice(0, i).reduce((a, b) => a + b, 0));
}

function share(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduce;
}

function useReveal() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return on;
}

function EmptyChart({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="grid place-items-center text-center rounded-2xl border border-dashed border-line bg-surface2/40 py-10 px-4">
      <div>
        <span
          className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-xl text-sm"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          aria-hidden
        >
          ◔
        </span>
        <p className="text-xs font-bold text-ink">{label}</p>
        <p className="text-[11px] text-faint mt-1 max-w-[280px]">{hint}</p>
      </div>
    </div>
  );
}

/* ---------- Sparkline ---------- */
export function Sparkline({
  data,
  color = "var(--accent)",
  width = 96,
  height = 30,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const id = useId().replace(/[:]/g, "");
  const series = data.length ? data : [0, 0];
  const max = Math.max(1, ...series);
  const pad = 3;
  const pts: [number, number][] = series.map((v, i) => [
    (i / Math.max(1, series.length - 1)) * width,
    height - pad - (v / max) * (height - pad * 2),
  ]);
  const line = smoothPath(pts);
  const last = pts[pts.length - 1];
  const rising = series[series.length - 1] >= series[0];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".34" />
          <stop offset=".65" stopColor={color} stopOpacity=".08" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={`url(#sp${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} />
      <circle cx={last[0]} cy={last[1]} r="4.6" fill={color} opacity={rising ? 0.22 : 0.12} />
    </svg>
  );
}

/* ---------- Area / Line ---------- */
export function AreaChart({
  data,
  compare,
  height = 260,
  color = "var(--accent)",
}: {
  data: DayPoint[];
  compare?: DayPoint[];
  height?: number;
  color?: string;
}) {
  const id = useId().replace(/[:]/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();

  const W = 800;
  const H = height;
  const P = { l: 52, r: 16, t: 18, b: 28 };

  const model = useMemo(() => {
    const values = data.map((d) => d.value);
    const cmpValues = (compare ?? []).map((d) => d.value);
    const max = niceCeil(Math.max(1, ...values, ...cmpValues));
    const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, data.length - 1);
    const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / max);
    const points: [number, number][] = data.map((d, i) => [x(i), y(d.value)]);
    const line = smoothPath(points);
    const area = points.length ? `${line} L ${x(data.length - 1)} ${H - P.b} L ${x(0)} ${H - P.b} Z` : "";
    const cmpLine = compare ? smoothPath(compare.map((d, i) => [x(i), y(d.value)])) : "";
    const peakIndex = values.length ? values.indexOf(Math.max(...values)) : -1;
    const total = values.reduce((a, b) => a + b, 0);
    const cmpTotal = cmpValues.reduce((a, b) => a + b, 0);
    const delta = cmpTotal > 0 ? ((total - cmpTotal) / cmpTotal) * 100 : null;
    return { max, x, y, line, area, cmpLine, peakIndex, total, delta };
  }, [data, compare, H, P.b, P.l, P.r, P.t]);

  const every = Math.max(1, Math.ceil(data.length / 7));

  const scrub = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || data.length === 0) return;
    const px = ((clientX - rect.left) / rect.width) * W;
    const step = (W - P.l - P.r) / Math.max(1, data.length - 1);
    setHover(Math.min(data.length - 1, Math.max(0, Math.round((px - P.l) / step))));
  };

  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!data.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const base = hover ?? model.peakIndex;
      const next = base + (e.key === "ArrowRight" ? 1 : -1);
      setHover(Math.min(data.length - 1, Math.max(0, next)));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHover(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHover(data.length - 1);
    } else if (e.key === "Escape") {
      setHover(null);
    }
  };

  if (!data.length) {
    return (
      <>
        <ChartStyles />
        <EmptyChart label="Belum ada tren harian" hint="Transaksi yang selesai akan otomatis membentuk kurva pendapatan di sini." />
      </>
    );
  }

  const active = hover !== null ? data[hover] : null;
  const activeCmp = hover !== null && compare ? compare[hover] : null;
  const dayDelta =
    active && activeCmp && activeCmp.value > 0 ? ((active.value - activeCmp.value) / activeCmp.value) * 100 : null;

  return (
    <div className={`relative ${reduce ? "" : "nusa-anim"}`}>
      <ChartStyles />

      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10.5px]">
        <span className="inline-flex items-center gap-1.5 font-bold text-mute">
          <span className="h-2 w-4 rounded-full" style={{ background: color }} /> Periode ini
        </span>
        {compare && (
          <span className="inline-flex items-center gap-1.5 font-bold text-mute">
            <span
              className="h-0 w-4 border-t-2 border-dashed"
              style={{ borderColor: "var(--violet)" }}
            />
            Periode sebelumnya
          </span>
        )}
        {model.delta !== null && (
          <span
            className="ml-auto rounded-full border px-2 py-0.5 font-mono font-bold tabular-nums"
            style={{
              color: model.delta >= 0 ? "var(--pandan)" : "var(--chili)",
              borderColor: `color-mix(in srgb, ${model.delta >= 0 ? "var(--pandan)" : "var(--chili)"} 35%, transparent)`,
              background: `color-mix(in srgb, ${model.delta >= 0 ? "var(--pandan)" : "var(--chili)"} 10%, transparent)`,
            }}
          >
            {model.delta >= 0 ? "▲" : "▼"} {Math.abs(model.delta).toFixed(1)}%
          </span>
        )}
      </div>

      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="nusa-chart w-full block"
        style={{ height: "auto", touchAction: "pan-y" }}
        tabIndex={0}
        role="img"
        aria-label={`Tren pendapatan ${data.length} hari, total ${rupiah(model.total)}. Gunakan panah kiri dan kanan untuk menelusuri.`}
        onPointerMove={(e) => scrub(e.clientX)}
        onPointerDown={(e) => scrub(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`ar${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".42" />
            <stop offset=".55" stopColor="var(--accent2)" stopOpacity=".16" />
            <stop offset="1" stopColor="var(--laut)" stopOpacity=".02" />
          </linearGradient>
          <linearGradient id={`ln${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--laut)" />
            <stop offset=".5" stopColor={color} />
            <stop offset="1" stopColor="var(--accent2)" />
          </linearGradient>
          <filter id={`gl${id}`} x="-30%" y="-60%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[0, 1, 2, 3, 4].map((k) => {
          const v = (model.max * k) / 4;
          return (
            <g key={k}>
              <line
                x1={P.l}
                x2={W - P.r}
                y1={model.y(v)}
                y2={model.y(v)}
                stroke="var(--line)"
                strokeDasharray={k === 0 ? "" : "3 6"}
              />
              <text x={P.l - 10} y={model.y(v) + 3} textAnchor="end" fontSize="10" fill="var(--faint)" className="font-mono">
                {compact(v)}
              </text>
            </g>
          );
        })}

        {data.map((d, i) =>
          i % every === 0 || i === data.length - 1 ? (
            <text key={`${d.label}-${i}`} x={model.x(i)} y={H - 9} textAnchor="middle" fontSize="10" fill="var(--faint)">
              {d.label}
            </text>
          ) : null
        )}

        <path
          d={model.area}
          fill={`url(#ar${id})`}
          className={reduce ? "" : "anim-fade"}
          style={reduce ? undefined : { animationDelay: ".3s", animationDuration: ".7s" }}
        />

        {compare && model.cmpLine && (
          <path
            d={model.cmpLine}
            fill="none"
            stroke="var(--violet)"
            strokeWidth="2"
            strokeDasharray="5 6"
            strokeLinecap="round"
            opacity=".85"
            className={reduce ? "" : "anim-fade"}
            style={reduce ? undefined : { animationDelay: ".25s" }}
          />
        )}

        <path
          d={model.line}
          fill="none"
          stroke={`url(#ln${id})`}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#gl${id})`}
          {...(reduce
            ? {}
            : {
                pathLength: 1,
                strokeDasharray: 1,
                strokeDashoffset: 1,
                style: { animation: "draw 1.1s .1s cubic-bezier(.4,0,.2,1) forwards" },
              })}
        />

        {hover === null && model.peakIndex >= 0 && (
          <g className={reduce ? "" : "anim-fade"} style={reduce ? undefined : { animationDelay: "1s" }}>
            <circle cx={model.x(model.peakIndex)} cy={model.y(data[model.peakIndex].value)} r="4" fill="var(--amber)" />
            <text
              x={model.x(model.peakIndex)}
              y={model.y(data[model.peakIndex].value) - 12}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="var(--amber)"
            >
              puncak {compact(data[model.peakIndex].value)}
            </text>
          </g>
        )}

        {hover !== null && (
          <g>
            <line x1={model.x(hover)} x2={model.x(hover)} y1={P.t} y2={H - P.b} stroke="var(--line2)" strokeWidth="1.5" />
            <rect
              x={model.x(hover) - 1}
              y={P.t}
              width="2"
              height={H - P.t - P.b}
              fill={color}
              opacity=".18"
            />
            {activeCmp && (
              <circle
                cx={model.x(hover)}
                cy={model.y(activeCmp.value)}
                r="4"
                fill="var(--violet)"
                stroke="var(--bg2)"
                strokeWidth="2"
              />
            )}
            <circle
              cx={model.x(hover)}
              cy={model.y(data[hover].value)}
              r="9"
              fill={color}
              opacity=".18"
            />
            <circle
              cx={model.x(hover)}
              cy={model.y(data[hover].value)}
              r="5"
              fill={color}
              stroke="var(--bg2)"
              strokeWidth="2.5"
            />
          </g>
        )}
      </svg>

      {active && hover !== null && (
        <div
          className="chart-tip"
          style={{
            left: `clamp(96px, ${(model.x(hover) / W) * 100}%, calc(100% - 96px))`,
            top: `${(model.y(active.value) / H) * 100}%`,
            pointerEvents: "none",
          }}
        >
          <p className="font-bold text-ink">{active.full}</p>
          <p className="font-mono font-bold tabular-nums" style={{ color }}>
            {rupiah(active.value)}
          </p>
          <p className="text-mute">
            {num(active.count)} transaksi • {num(active.items)} item
          </p>
          {activeCmp && (
            <p className="text-violet">
              Sebelumnya: {rupiah(activeCmp.value)}
              {dayDelta !== null && (
                <span style={{ color: dayDelta >= 0 ? "var(--pandan)" : "var(--chili)" }}>
                  {" "}
                  ({dayDelta >= 0 ? "+" : ""}
                  {dayDelta.toFixed(0)}%)
                </span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Donut ---------- */
export function Donut({
  data,
  size = 190,
  thick = 24,
  centerTitle = "Total",
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thick?: number;
  centerTitle?: string;
}) {
  const id = useId().replace(/[:]/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<number[]>([]);
  const on = useReveal();
  const reduce = useReducedMotion();

  const rows = useMemo(
    () => data.map((d, i) => ({ ...d, index: i, color: d.color || SERIES_HUES[i % SERIES_HUES.length] })),
    [data]
  );

  const model = useMemo(() => {
    const shown = rows.filter((r) => !hidden.includes(r.index));
    const total = shown.reduce((a, d) => a + d.value, 0);
    const pcts = shown.map((d) => share(d.value, total));
    const offsets = cumulative(pcts);
    const segs = shown.map((d, i) => ({ ...d, pct: pcts[i], offset: offsets[i] }));
    return { shown, total, segs };
  }, [rows, hidden]);

  const radius = (size - thick - 10) / 2;
  const activeRow = hover !== null ? rows.find((r) => r.index === hover) ?? null : null;
  const activeVisible = activeRow ? !hidden.includes(activeRow.index) : false;
  const centerValue = activeRow && activeVisible ? activeRow.value : model.total;
  const centerPct = activeRow && activeVisible ? share(activeRow.value, model.total) : null;

  const toggle = (index: number) => {
    const isHidden = hidden.includes(index);
    if (!isHidden && model.shown.length <= 1) return;
    setHidden((prev) => (isHidden ? prev.filter((i) => i !== index) : [...prev, index]));
    setHover(null);
  };

  if (!rows.length) {
    return (
      <>
        <ChartStyles />
        <EmptyChart label="Belum ada komposisi" hint="Bagian akan muncul begitu ada transaksi pada periode ini." />
      </>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center gap-5 ${reduce ? "" : "nusa-anim"}`}>
      <ChartStyles />

      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Komposisi ${centerTitle}: ${model.shown.map((s) => `${s.label} ${share(s.value, model.total).toFixed(0)} persen`).join(", ")}`}
        >
          <defs>
            <filter id={`dg${id}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="3.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {model.segs.map((s) => (
              <pattern
                key={`p${s.index}`}
                id={`dp${id}${s.index}`}
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform={`rotate(${(s.index * 35) % 180})`}
              >
                <rect width="6" height="6" fill={s.color} />
                <circle cx="3" cy="3" r={s.index % 2 === 0 ? 1.1 : 0.7} fill="var(--bg2)" opacity=".38" />
              </pattern>
            ))}
          </defs>

          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface2)" strokeWidth={thick} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius - thick / 2 - 3}
            fill="none"
            stroke="var(--line)"
            strokeWidth="1"
            strokeDasharray="2 6"
          />

          {model.segs.map((s) => {
            const isActive = hover === s.index;
            const gap = model.segs.length > 1 ? 1 : 0;
            const dash = Math.max(0, s.pct - gap);
            return (
              <circle
                key={s.index}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={isActive ? `url(#dp${id}${s.index})` : s.color}
                strokeWidth={isActive ? thick + 7 : thick}
                strokeLinecap="butt"
                pathLength={100}
                strokeDasharray={on || reduce ? `${dash} ${100 - dash}` : "0 100"}
                strokeDashoffset={25 - s.offset - gap / 2}
                filter={isActive ? `url(#dg${id})` : undefined}
                opacity={hover === null || isActive ? 1 : 0.42}
                className="nusa-hit"
                style={{
                  transition: reduce
                    ? "none"
                    : `stroke-dasharray .8s cubic-bezier(.4,0,.2,1) ${s.index * 60}ms, stroke-width .2s, opacity .2s`,
                }}
                onMouseEnter={() => setHover(s.index)}
                onMouseLeave={() => setHover(null)}
                onClick={() => toggle(s.index)}
              />
            );
          })}

          {model.segs
            .filter((s) => s.pct >= 9)
            .map((s) => {
              const angle = ((s.offset + s.pct / 2 - 25) / 100) * Math.PI * 2;
              const lx = size / 2 + Math.cos(angle) * radius;
              const ly = size / 2 + Math.sin(angle) * radius;
              return (
                <text
                  key={`l${s.index}`}
                  x={lx}
                  y={ly + 3.5}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="800"
                  fill="var(--bg)"
                  pointerEvents="none"
                  opacity={on || reduce ? 1 : 0}
                  style={{ transition: reduce ? "none" : "opacity .5s .7s" }}
                >
                  {s.pct.toFixed(0)}%
                </text>
              );
            })}
        </svg>

        <div className="absolute inset-0 grid place-items-center text-center pointer-events-none px-6">
          <div>
            <p className="text-[10px] font-bold text-faint uppercase tracking-wider truncate">
              {activeRow && activeVisible ? activeRow.label : centerTitle}
            </p>
            <p
              className="font-display font-bold text-lg tabular-nums"
              style={{ color: activeRow && activeVisible ? activeRow.color : "var(--text)" }}
            >
              {centerPct !== null ? `${centerPct.toFixed(1)}%` : compactRp(centerValue)}
            </p>
            {activeRow && activeVisible && (
              <p className="text-[10px] font-mono text-mute">{compactRp(activeRow.value)}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 w-full">
        <ul className="space-y-1.5">
          {rows.map((d) => {
            const off = hidden.includes(d.index);
            const pct = off ? 0 : share(d.value, model.total);
            return (
              <li key={`${d.label}-${d.index}`}>
                <button
                  type="button"
                  onClick={() => toggle(d.index)}
                  onMouseEnter={() => setHover(d.index)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(d.index)}
                  onBlur={() => setHover(null)}
                  aria-pressed={!off}
                  title={off ? `Tampilkan ${d.label}` : `Sembunyikan ${d.label} dari hitungan`}
                  className="nusa-hit flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
                  style={{
                    background: hover === d.index ? "var(--surface2)" : "transparent",
                    opacity: off ? 0.45 : 1,
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background: off ? "transparent" : d.color,
                      boxShadow: `inset 0 0 0 1.5px ${d.color}`,
                    }}
                  />
                  <span className={`flex-1 truncate text-left font-semibold ${off ? "line-through" : ""}`}>{d.label}</span>
                  <span className="w-9 text-right font-mono tabular-nums text-faint">{pct.toFixed(0)}%</span>
                  <span className="w-20 text-right font-mono font-bold tabular-nums text-mute">{compactRp(d.value)}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-2 flex items-center gap-2 px-2 text-[10px] text-faint">
          <span>Klik label untuk menyaring segmen</span>
          {hidden.length > 0 && (
            <button
              type="button"
              onClick={() => setHidden([])}
              className="nusa-hit ml-auto rounded-full border border-line px-2 py-0.5 font-bold text-accent transition-colors hover:border-accent"
            >
              Tampilkan semua ({hidden.length} disembunyikan)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Bars per jam ---------- */
export function Bars({
  data,
  height = 220,
  color = "var(--accent)",
}: {
  data: { label: string; value: number; revenue: number }[];
  height?: number;
  color?: string;
}) {
  const id = useId().replace(/[:]/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useReducedMotion();

  const W = 800;
  const H = height;
  const P = { l: 34, r: 12, t: 22, b: 26 };

  const model = useMemo(() => {
    const values = data.map((d) => d.value);
    const max = niceCeil(Math.max(1, ...values));
    const step = data.length ? (W - P.l - P.r) / data.length : 0;
    const bw = step * 0.58;
    const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / max);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? total / values.length : 0;
    const peakIndex = values.length ? values.indexOf(Math.max(...values)) : -1;
    return { max, step, bw, y, total, avg, peakIndex };
  }, [data, H, P.b, P.l, P.r, P.t]);

  const scrub = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || !data.length) return;
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.floor((px - P.l) / model.step);
    setHover(i >= 0 && i < data.length ? i : null);
  };

  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!data.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const base = hover ?? model.peakIndex;
      setHover(Math.min(data.length - 1, Math.max(0, base + (e.key === "ArrowRight" ? 1 : -1))));
    } else if (e.key === "Escape") {
      setHover(null);
    }
  };

  if (!data.length) {
    return (
      <>
        <ChartStyles />
        <EmptyChart label="Belum ada aktivitas per jam" hint="Jam ramai akan terlihat setelah ada transaksi tercatat." />
      </>
    );
  }

  const active = hover !== null ? data[hover] : null;

  return (
    <div className={`relative ${reduce ? "" : "nusa-anim"}`}>
      <ChartStyles />

      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10.5px] text-faint">
        <span className="inline-flex items-center gap-1.5 font-bold text-mute">
          <span className="h-2 w-4 rounded-full" style={{ background: color }} /> Transaksi / jam
        </span>
        <span className="inline-flex items-center gap-1.5 font-bold text-mute">
          <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: "var(--amber)" }} /> Rata-rata{" "}
          {model.avg.toFixed(1)}
        </span>
        {model.peakIndex >= 0 && (
          <span className="ml-auto font-bold" style={{ color: "var(--amber)" }}>
            Puncak {data[model.peakIndex].label}.00 · {num(data[model.peakIndex].value)} trx
          </span>
        )}
      </div>

      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="nusa-chart w-full block"
        style={{ touchAction: "pan-y" }}
        tabIndex={0}
        role="img"
        aria-label={`Distribusi transaksi per jam, total ${num(model.total)} transaksi. Gunakan panah untuk menelusuri.`}
        onPointerMove={(e) => scrub(e.clientX)}
        onPointerDown={(e) => scrub(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`bg${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} />
            <stop offset="1" stopColor="var(--laut)" stopOpacity=".55" />
          </linearGradient>
          <linearGradient id={`bh${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--amber)" />
            <stop offset="1" stopColor="var(--chili)" stopOpacity=".7" />
          </linearGradient>
        </defs>

        {[0, 1, 2].map((k) => {
          const v = (model.max * k) / 2;
          return (
            <g key={k}>
              <line
                x1={P.l}
                x2={W - P.r}
                y1={model.y(v)}
                y2={model.y(v)}
                stroke="var(--line)"
                strokeDasharray={k === 0 ? "" : "3 6"}
              />
              <text x={P.l - 8} y={model.y(v) + 3} textAnchor="end" fontSize="10" fill="var(--faint)" className="font-mono">
                {compact(v)}
              </text>
            </g>
          );
        })}

        {model.avg > 0 && (
          <g>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={model.y(model.avg)}
              y2={model.y(model.avg)}
              stroke="var(--amber)"
              strokeWidth="1.5"
              strokeDasharray="6 5"
              opacity=".8"
            />
            <text x={W - P.r} y={model.y(model.avg) - 5} textAnchor="end" fontSize="9" fontWeight="700" fill="var(--amber)">
              rata-rata
            </text>
          </g>
        )}

        {data.map((d, i) => {
          const bx = P.l + i * model.step + (model.step - model.bw) / 2;
          const bh = Math.max(0, H - P.b - model.y(d.value));
          const isActive = hover === i;
          const isPeak = i === model.peakIndex && d.value > 0;
          return (
            <g key={`${d.label}-${i}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={P.l + i * model.step} y={P.t} width={model.step} height={H - P.t - P.b} fill="transparent" />
              {isActive && (
                <rect
                  x={P.l + i * model.step + 1}
                  y={P.t}
                  width={model.step - 2}
                  height={H - P.t - P.b}
                  rx="6"
                  fill="var(--amber)"
                  opacity=".08"
                />
              )}
              <rect
                x={bx}
                y={model.y(d.value)}
                width={model.bw}
                height={bh}
                rx="4"
                fill={isActive ? `url(#bh${id})` : `url(#bg${id})`}
                opacity={hover === null || isActive ? 1 : 0.42}
                className={reduce ? "" : "bar-grow"}
                style={{
                  animationDelay: `${i * 25}ms`,
                  transition: reduce ? "none" : "fill .15s, opacity .15s",
                }}
              />
              {isPeak && !isActive && (
                <circle cx={bx + model.bw / 2} cy={model.y(d.value) - 7} r="2.6" fill="var(--amber)" />
              )}
              {(isActive || isPeak) && d.value > 0 && (
                <text
                  x={bx + model.bw / 2}
                  y={model.y(d.value) - (isPeak && !isActive ? 14 : 7)}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="700"
                  fill="var(--amber)"
                  className="font-mono"
                >
                  {num(d.value)}
                </text>
              )}
              <text
                x={bx + model.bw / 2}
                y={H - 9}
                textAnchor="middle"
                fontSize="9"
                fontWeight={isActive ? 700 : 400}
                fill={isActive ? "var(--amber)" : "var(--faint)"}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {active && hover !== null && (
        <div
          className="chart-tip"
          style={{
            left: `clamp(100px, ${((P.l + hover * model.step + model.step / 2) / W) * 100}%, calc(100% - 100px))`,
            top: `${(model.y(active.value) / H) * 100}%`,
            pointerEvents: "none",
          }}
        >
          <p className="font-bold text-ink">
            {active.label}.00–{String((Number(active.label) + 1) % 24).padStart(2, "0")}.00
          </p>
          <p className="font-mono font-bold tabular-nums" style={{ color: "var(--amber)" }}>
            {compactRp(active.revenue)}
          </p>
          <p className="text-mute">
            {num(active.value)} transaksi • {share(active.value, model.total).toFixed(1)}% dari hari ini
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- Heatmap hari × jam ---------- */
function heatColor(t: number) {
  const x = Math.max(0, Math.min(1, t));
  if (x <= 0) return "var(--surface2)";
  const stops: [string, string][] = [
    ["var(--laut)", "var(--accent)"],
    ["var(--accent)", "var(--amber)"],
    ["var(--amber)", "var(--chili)"],
  ];
  const seg = Math.min(2, Math.floor(x * 3));
  const f = x * 3 - seg;
  const [a, b] = stops[seg];
  return `color-mix(in srgb, ${b} ${Math.round(28 + 72 * f)}%, ${a})`;
}

export function Heatmap({ matrix }: { matrix: number[][] }) {
  const [cell, setCell] = useState<{ r: number; c: number } | null>(null);
  const cols = HOURS.length;

  const model = useMemo(() => {
    const rows = WEEKDAYS.map((_, r) => matrix[r] ?? []);
    const flat = rows.flat();
    const max = Math.max(1, ...flat);
    const rowTotals = rows.map((row) => row.reduce((a, b) => a + b, 0));
    const colTotals = HOURS.map((_, c) => rows.reduce((a, row) => a + (row[c] ?? 0), 0));
    const total = rowTotals.reduce((a, b) => a + b, 0);
    let peak = { r: 0, c: 0, v: 0 };
    rows.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v > peak.v) peak = { r, c, v };
      })
    );
    const busiestDay = rowTotals.length ? rowTotals.indexOf(Math.max(...rowTotals)) : 0;
    const busiestHour = colTotals.length ? colTotals.indexOf(Math.max(...colTotals)) : 0;
    return { rows, max, rowTotals, colTotals, total, peak, busiestDay, busiestHour };
  }, [matrix, cols]);

  const shown = cell ?? { r: model.peak.r, c: model.peak.c };
  const shownValue = model.rows[shown.r]?.[shown.c] ?? 0;

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"];
    if (!keys.includes(e.key)) {
      if (e.key === "Escape") setCell(null);
      return;
    }
    e.preventDefault();
    const dr = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    const dc = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    setCell({
      r: Math.min(WEEKDAYS.length - 1, Math.max(0, shown.r + dr)),
      c: Math.min(cols - 1, Math.max(0, shown.c + dc)),
    });
  };

  if (!model.total) {
    return (
      <>
        <ChartStyles />
        <EmptyChart label="Belum ada pola ramai" hint="Heatmap hari × jam terisi otomatis dari riwayat transaksi." />
      </>
    );
  }

  return (
    <div>
      <ChartStyles />

      <div className="nusa-scroll overflow-x-auto pb-1" tabIndex={0} role="grid" aria-label="Heatmap transaksi hari dan jam" onKeyDown={onKey}>
        <div className="min-w-[600px]">
          <div className="grid gap-[3px]" style={{ gridTemplateColumns: `40px repeat(${cols}, minmax(0,1fr)) 44px` }}>
            <span />
            {HOURS.map((h, c) => (
              <span
                key={h}
                className="text-center font-mono text-[9px] transition-colors"
                style={{ color: shown.c === c ? "var(--accent)" : "var(--faint)", fontWeight: shown.c === c ? 700 : 400 }}
              >
                {h}
              </span>
            ))}
            <span className="text-[9px] font-bold text-faint text-right pr-1">Σ</span>

            {WEEKDAYS.map((d, r) => (
              <HeatRow
                key={d}
                label={d}
                row={model.rows[r]}
                rowIndex={r}
                max={model.max}
                total={model.rowTotals[r]}
                activeRow={shown.r}
                activeCol={shown.c}
                isBusiest={r === model.busiestDay}
                onPick={(c) => setCell({ r, c })}
              />
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-faint">
            <span>Sepi</span>
            <span
              className="h-2 w-[150px] rounded-full border border-line"
              style={{ background: "linear-gradient(90deg, var(--surface2), var(--laut), var(--accent), var(--amber), var(--chili))" }}
            />
            <span>Ramai</span>
            <span className="ml-auto font-mono">maks {num(model.max)} trx / jam</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-[4px]" style={{ background: heatColor(Math.sqrt(shownValue / model.max)) }} />
          <p className="text-xs font-bold text-ink">
            {WEEKDAYS[shown.r]} · {String(HOURS[shown.c]).padStart(2, "0")}.00
          </p>
        </div>
        <p className="font-mono text-xs font-bold tabular-nums" style={{ color: "var(--accent)" }}>
          {num(shownValue)} transaksi
        </p>
        <p className="text-[11px] text-mute">{share(shownValue, model.total).toFixed(1)}% dari total periode</p>
        <p className="ml-auto text-[10.5px] text-faint">
          Tersibuk: <b className="text-mute">{WEEKDAYS[model.busiestDay]}</b> ·{" "}
          <b className="text-mute">{String(HOURS[model.busiestHour]).padStart(2, "0")}.00</b> — panah keyboard untuk menelusuri
        </p>
      </div>
    </div>
  );
}

function HeatRow({
  label,
  row,
  rowIndex,
  max,
  total,
  activeRow,
  activeCol,
  isBusiest,
  onPick,
}: {
  label: string;
  row: number[];
  rowIndex: number;
  max: number;
  total: number;
  activeRow: number;
  activeCol: number;
  isBusiest: boolean;
  onPick: (col: number) => void;
}) {
  return (
    <>
      <span
        className="flex items-center text-[10px] font-bold transition-colors"
        style={{ color: activeRow === rowIndex ? "var(--accent)" : isBusiest ? "var(--amber)" : "var(--muted)" }}
      >
        {label}
      </span>
      {HOURS.map((h, c) => {
        const v = row[c] ?? 0;
        const isActive = activeRow === rowIndex && activeCol === c;
        const inCross = activeRow === rowIndex || activeCol === c;
        return (
          <div
            key={h}
            role="gridcell"
            aria-label={`${label} ${h}.00, ${v} transaksi`}
            title={`${label} ${String(h).padStart(2, "0")}.00 — ${num(v)} transaksi`}
            onMouseEnter={() => onPick(c)}
            onClick={() => onPick(c)}
            className="h-[19px] rounded-[4px] transition-transform duration-150"
            style={{
              background: heatColor(Math.sqrt(v / max)),
              opacity: v > 0 ? (inCross ? 1 : 0.78) : 0.42,
              transform: isActive ? "scale(1.16)" : "scale(1)",
              boxShadow: isActive ? "0 0 0 1.5px var(--accent), 0 6px 16px -8px var(--accent)" : "none",
              cursor: "pointer",
            }}
          />
        );
      })}
      <span
        className="flex items-center justify-end pr-1 font-mono text-[9.5px] tabular-nums"
        style={{ color: isBusiest ? "var(--amber)" : "var(--faint)", fontWeight: isBusiest ? 700 : 400 }}
      >
        {compact(total)}
      </span>
    </>
  );
}

/* ---------- Top produk ---------- */
export function HBarList({
  items,
}: {
  items: { name: string; emoji: string; category: Category; qty: number; revenue: number }[];
}) {
  const [metric, setMetric] = useState<"revenue" | "qty">("revenue");
  const [hover, setHover] = useState<string | null>(null);

  const model = useMemo(() => {
    const sorted = [...items].sort((a, b) => (metric === "revenue" ? b.revenue - a.revenue : b.qty - a.qty));
    const max = Math.max(1, ...sorted.map((i) => (metric === "revenue" ? i.revenue : i.qty)));
    const total = sorted.reduce((a, i) => a + i.revenue, 0);
    return { sorted, max, total };
  }, [items, metric]);

  if (!items.length) {
    return (
      <>
        <ChartStyles />
        <EmptyChart label="Belum ada penjualan produk" hint="Peringkat produk terlaris muncul setelah transaksi pertama." />
      </>
    );
  }

  const medal = (i: number) => (i === 0 ? "var(--amber)" : i === 1 ? "var(--muted)" : i === 2 ? "var(--chili)" : "var(--faint)");

  return (
    <div>
      <ChartStyles />

      <div className="mb-3 flex items-center gap-2">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Urutkan</p>
        <div className="flex rounded-full border border-line p-0.5" style={{ background: "var(--surface2)" }}>
          {([
            { v: "revenue" as const, l: "Omzet" },
            { v: "qty" as const, l: "Terjual" },
          ]).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMetric(o.v)}
              aria-pressed={metric === o.v}
              className="nusa-hit rounded-full px-2.5 py-1 text-[10.5px] font-bold transition-colors"
              style={{
                color: metric === o.v ? "var(--accent-ink)" : "var(--muted)",
                background: metric === o.v ? "linear-gradient(135deg, var(--accent), var(--accent2))" : "transparent",
              }}
            >
              {o.l}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[10.5px] text-faint">{compactRp(model.total)} total</span>
      </div>

      <ul className="space-y-3">
        {model.sorted.map((p, i) => {
          const c = CATEGORY_COLORS[p.category] ?? SERIES_HUES[i % SERIES_HUES.length];
          const value = metric === "revenue" ? p.revenue : p.qty;
          const width = (value / model.max) * 100;
          const isHover = hover === p.name;
          return (
            <li
              key={p.name}
              className="rise flex items-center gap-3 rounded-xl px-1.5 py-1 transition-colors"
              style={{ animationDelay: `${i * 55}ms`, background: isHover ? "var(--surface2)" : "transparent" }}
              onMouseEnter={() => setHover(p.name)}
              onMouseLeave={() => setHover(null)}
            >
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-md font-mono text-[10px] font-bold"
                style={{
                  color: i < 3 ? "var(--bg)" : "var(--faint)",
                  background: i < 3 ? medal(i) : "transparent",
                }}
              >
                {i + 1}
              </span>
              <span className="text-xl leading-none" aria-hidden>
                {p.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-xs font-bold">{p.name}</p>
                  <p className="shrink-0 font-mono text-[11px] tabular-nums text-mute">
                    {isHover ? rupiah(p.revenue) : compactRp(p.revenue)} <span className="text-faint">×{num(p.qty)}</span>
                  </p>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface2">
                  <div
                    className="bar-grow-x h-full rounded-full"
                    style={{
                      width: `${Math.max(2, width)}%`,
                      background: `linear-gradient(90deg, ${c}, color-mix(in srgb, ${c} 45%, var(--laut)))`,
                      boxShadow: isHover ? `0 0 12px -2px ${c}` : "none",
                      animationDelay: `${i * 70}ms`,
                      transition: "box-shadow .2s, width .45s cubic-bezier(.4,0,.2,1)",
                    }}
                  />
                </div>
                <div className="mt-1 flex items-center gap-2 text-[9.5px] text-faint">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                    {p.category}
                  </span>
                  <span className="ml-auto font-mono">{share(p.revenue, model.total).toFixed(1)}% omzet</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Split metode bayar ---------- */
export function PaymentSplit({
  data,
}: {
  data: { method: string; value: number; count: number; color: string }[];
}) {
  const [active, setActive] = useState<string | null>(null);

  const model = useMemo(() => {
    const rows = data.map((d, i) => ({ ...d, color: d.color || SERIES_HUES[i % SERIES_HUES.length] }));
    const total = rows.reduce((a, d) => a + d.value, 0);
    const count = rows.reduce((a, d) => a + d.count, 0);
    const widths = rows.map((d) => (d.value > 0 ? Math.max(2.5, share(d.value, total)) : 0));
    const leader = rows.reduce<{ method: string; value: number } | null>(
      (best, d) => (best === null || d.value > best.value ? { method: d.method, value: d.value } : best),
      null
    );
    return { rows, total, count, widths, leader };
  }, [data]);

  if (!model.rows.length || model.total <= 0) {
    return (
      <>
        <ChartStyles />
        <EmptyChart label="Belum ada pembayaran" hint="Komposisi Tunai, QRIS, dan Kartu muncul setelah transaksi selesai." />
      </>
    );
  }

  const focused = active ? model.rows.find((d) => d.method === active) ?? null : null;

  return (
    <div>
      <ChartStyles />

      <div className="flex h-3.5 overflow-hidden rounded-full border border-line bg-surface2">
        {model.rows.map((d, i) =>
          d.value > 0 ? (
            <button
              key={d.method}
              type="button"
              aria-label={`${d.method}: ${rupiah(d.value)}`}
              title={`${d.method}: ${rupiah(d.value)} · ${num(d.count)} transaksi`}
              onMouseEnter={() => setActive(d.method)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(d.method)}
              onBlur={() => setActive(null)}
              onClick={() => setActive((prev) => (prev === d.method ? null : d.method))}
              className="h-full"
              style={{
                width: `${model.widths[i]}%`,
                background: `linear-gradient(180deg, ${d.color}, color-mix(in srgb, ${d.color} 62%, var(--bg2)))`,
                opacity: active === null || active === d.method ? 1 : 0.35,
                boxShadow: active === d.method ? `0 0 14px -2px ${d.color}` : "none",
                transition: "width .6s cubic-bezier(.4,0,.2,1), opacity .2s, box-shadow .2s",
                cursor: "pointer",
              }}
            />
          ) : null
        )}
      </div>

      <div className="mt-2 flex items-center gap-2 text-[10.5px]">
        {focused ? (
          <>
            <span className="h-2 w-2 rounded-full" style={{ background: focused.color }} />
            <span className="font-bold text-ink">{focused.method}</span>
            <span className="font-mono font-bold tabular-nums" style={{ color: focused.color }}>
              {rupiah(focused.value)}
            </span>
            <span className="text-faint">
              {num(focused.count)} trx · rata-rata {compactRp(focused.count ? focused.value / focused.count : 0)}
            </span>
          </>
        ) : (
          <>
            <span className="text-faint">Total {num(model.count)} transaksi</span>
            {model.leader && (
              <span className="ml-auto font-bold" style={{ color: "var(--accent)" }}>
                Terbesar: {model.leader.method}
              </span>
            )}
          </>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {model.rows.map((d) => {
          const pct = share(d.value, model.total);
          const isActive = active === d.method;
          return (
            <li key={d.method}>
              <button
                type="button"
                onMouseEnter={() => setActive(d.method)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(d.method)}
                onBlur={() => setActive(null)}
                onClick={() => setActive((prev) => (prev === d.method ? null : d.method))}
                aria-pressed={isActive}
                className="nusa-hit flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors"
                style={{ background: isActive ? "var(--surface2)" : "transparent" }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: d.color, boxShadow: isActive ? `0 0 10px -1px ${d.color}` : "none" }}
                />
                <span className="flex-1 text-left font-bold">{d.method}</span>
                <span className="w-14 text-right text-faint">{num(d.count)} trx</span>
                <span className="w-10 text-right font-mono tabular-nums text-faint">{pct.toFixed(0)}%</span>
                <span className="w-20 text-right font-mono font-bold tabular-nums text-mute">{compactRp(d.value)}</span>
              </button>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-surface2">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: d.color,
                    opacity: isActive ? 1 : 0.5,
                    transition: "width .6s cubic-bezier(.4,0,.2,1), opacity .2s",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}