"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

/**
 * Teks berjalan mulus berbasis requestAnimationFrame.
 * - tanpa lompatan saat loop (konten diduplikasi sesuai lebar wadah)
 * - jeda saat hover / tab tidak aktif / prefers-reduced-motion
 * - bisa digeser dengan jari atau mouse
 */
export function Marquee({
  children,
  speed = 46,
  direction = "left",
  gap = 28,
  paused = false,
  fade = true,
  className = "",
  ariaLabel = "Informasi berjalan",
}: {
  children: ReactNode;
  speed?: number;
  direction?: "left" | "right";
  gap?: number;
  paused?: boolean;
  fade?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const pos = useRef(0);
  const raf = useRef(0);
  const last = useRef(0);
  const dragX = useRef(0);
  const visible = useRef(true);

  const [loop, setLoop] = useState(0);
  const [copies, setCopies] = useState(2);
  const [hover, setHover] = useState(false);
  const [drag, setDrag] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const measure = () => {
      const g = groupRef.current;
      const w = wrapRef.current;
      if (!g || !w) return;
      const gw = g.getBoundingClientRect().width;
      const ww = w.getBoundingClientRect().width;
      if (gw <= 0) return;
      const l = gw + gap;
      setLoop(l);
      setCopies(Math.max(2, Math.ceil(ww / l) + 2));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    if (groupRef.current) ro.observe(groupRef.current);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [gap]);

  useEffect(() => {
    const onVis = () => { visible.current = document.visibilityState === "visible"; last.current = 0; };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const paint = () => {
      const t = trackRef.current;
      if (!t || loop <= 0) return;
      const p = ((pos.current % loop) + loop) % loop;
      const x = direction === "left" ? -p : p - loop;
      t.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    };
    paint();

    const stop = () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
      last.current = 0;
    };

    if (paused || hover || drag || reduced || loop <= 0) { stop(); return; }

    const tick = (now: number) => {
      if (!last.current) last.current = now;
      const dt = Math.min(64, now - last.current);
      last.current = now;
      if (visible.current) pos.current += (speed * dt) / 1000;
      paint();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return stop;
  }, [paused, hover, drag, reduced, loop, speed, direction]);

  const scrub = (clientX: number) => {
    const dx = clientX - dragX.current;
    dragX.current = clientX;
    pos.current -= dx;
    const t = trackRef.current;
    if (t && loop > 0) {
      const p = ((pos.current % loop) + loop) % loop;
      t.style.transform = `translate3d(${(direction === "left" ? -p : p - loop).toFixed(2)}px,0,0)`;
    }
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (reduced) return;
    setDrag(true);
    dragX.current = e.clientX;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* abaikan */ }
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => { if (drag) scrub(e.clientX); };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* abaikan */ }
  };

  const mask = fade ? "linear-gradient(90deg, transparent 0, #000 4%, #000 96%, transparent 100%)" : undefined;

  return (
    <div
      ref={wrapRef}
      role="region"
      aria-label={ariaLabel}
      tabIndex={reduced ? 0 : -1}
      className={`${reduced ? "overflow-x-auto" : "overflow-hidden"} ${drag ? "cursor-grabbing" : "cursor-grab"} ${className}`}
      style={{ WebkitMaskImage: mask, maskImage: mask, touchAction: "pan-y" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div ref={trackRef} className="flex w-max will-change-transform" style={{ gap }}>
        {Array.from({ length: copies }).map((_, i) => (
          <div
            key={i}
            ref={i === 0 ? groupRef : undefined}
            aria-hidden={i > 0}
            className="flex shrink-0 items-center"
            style={{ gap }}
          >
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}