const KEY = "nusapos:member-logins:v2";
const MASK = 0x5a;

export interface SavedMemberLogin {
  id: string;
  username: string;
  pin: string;
  name?: string;
  memberNo?: string;
  updatedAt: number;
}

function encode(value: string) {
  try {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((b) => { binary += String.fromCharCode(b ^ MASK); });
    return btoa(binary);
  } catch {
    return value;
  }
}

function decode(value: string) {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0) ^ MASK);
    return new TextDecoder().decode(bytes);
  } catch {
    return value;
  }
}

function persist(list: SavedMemberLogin[]) {
  if (typeof window === "undefined") return;
  try {
    const encoded = list.map((x) => ({ ...x, pin: encode(x.pin) }));
    localStorage.setItem(KEY, JSON.stringify(encoded));
  } catch { /* penuh / blocked */ }
}

export function loadSavedMemberLogins(): SavedMemberLogin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => ({
        id: String(x.id ?? x.username ?? "").toLowerCase(),
        username: String(x.username ?? "").toLowerCase(),
        pin: decode(String(x.pin ?? "")),
        name: x.name ? String(x.name) : undefined,
        memberNo: x.memberNo ? String(x.memberNo) : undefined,
        updatedAt: Number(x.updatedAt) || 0,
      }))
      .filter((x) => x.id && x.username && x.pin)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function saveMemberLogin(input: {
  username: string;
  pin: string;
  name?: string;
  memberNo?: string;
}): SavedMemberLogin[] {
  const username = input.username.trim().toLowerCase();
  if (!username || !input.pin) return loadSavedMemberLogins();

  const current = loadSavedMemberLogins();
  const next: SavedMemberLogin[] = [
    {
      id: username,
      username,
      pin: input.pin,
      name: input.name,
      memberNo: input.memberNo,
      updatedAt: Date.now(),
    },
    ...current.filter((x) => x.id !== username),
  ].slice(0, 5);

  persist(next);
  return next;
}

export function removeMemberLogin(id: string) {
  const current = loadSavedMemberLogins();
  persist(current.filter((x) => x.id !== id));
}

export function clearMemberLogins() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}