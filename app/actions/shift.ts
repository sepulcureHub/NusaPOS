"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

export interface LiveShift {
  id: string;
  openedAt: number;
  openingCash: number;
}

export interface ShiftActionResult {
  ok: boolean;
  error?: string;
  shift?: LiveShift | null;
  expectedCash?: number;
  variance?: number;
}

export async function getMyShift(): Promise<ShiftActionResult> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Belum login" };

  const { data, error } = await sb
    .from("shift_sessions")
    .select("id, opened_at, opening_cash")
    .eq("user_id", user.id)
    .is("closed_at", null)
    .maybeSingle();

  if (error) return { ok: false, error: "Gagal membaca shift" };
  return {
    ok: true,
    shift: data
      ? {
          id: data.id as string,
          openedAt: Date.parse(data.opened_at as string),
          openingCash: Number(data.opening_cash),
        }
      : null,
  };
}

const openSchema = z.number().int().min(0).max(1_000_000_000);

export async function openShift(openingCash: number): Promise<ShiftActionResult> {
  const v = openSchema.safeParse(openingCash);
  if (!v.success) return { ok: false, error: "Modal awal tidak valid" };

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("open_shift", { p_opening_cash: v.data });
  if (error) return { ok: false, error: "Server gagal membuka shift" };
  const res = data as { ok: boolean; id?: string; opened_at?: string; error?: string };
  if (!res.ok) return { ok: false, error: res.error ?? "Shift ditolak server" };
  return {
    ok: true,
    shift: {
      id: res.id!,
      openedAt: Date.parse(res.opened_at!),
      openingCash: v.data,
    },
  };
}

const closeSchema = z.object({
  sessionId: z.string().uuid(),
  closingCash: z.number().int().min(0).max(1_000_000_000),
  note: z.string().max(200),
});

export async function closeShift(
  sessionId: string, closingCash: number, note: string
): Promise<ShiftActionResult> {
  const v = closeSchema.safeParse({ sessionId, closingCash, note });
  if (!v.success) return { ok: false, error: "Input penutupan tidak valid" };

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("close_shift", {
    p_session_id: v.data.sessionId,
    p_closing_cash: v.data.closingCash,
    p_note: v.data.note,
  });
  if (error) return { ok: false, error: "Server gagal menutup shift" };
  const res = data as { ok: boolean; expected_cash?: number; variance?: number; error?: string };
  if (!res.ok) return { ok: false, error: res.error ?? "Penutupan ditolak server" };
  return { ok: true, shift: null, expectedCash: res.expected_cash, variance: res.variance };
}