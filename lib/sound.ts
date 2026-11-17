let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(v: boolean) { enabled = v; }

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = "sine", vol = 0.07) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = c.currentTime + at;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  tap() { if (enabled) tone(660, 0, 0.07, "sine", 0.05); },
  add() { if (enabled) { tone(520, 0, 0.06, "sine", 0.06); tone(780, 0.05, 0.09, "sine", 0.06); } },
  remove() { if (enabled) tone(300, 0, 0.09, "triangle", 0.06); },
  hold() { if (enabled) { tone(440, 0, 0.08); tone(330, 0.09, 0.12); } },
  error() { if (enabled) { tone(180, 0, 0.12, "square", 0.045); tone(140, 0.1, 0.14, "square", 0.045); } },
  success() { if (enabled) [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.16, "sine", 0.07)); },
  cash() { if (enabled) { tone(1200, 0, 0.05, "square", 0.035); tone(1600, 0.06, 0.08, "square", 0.035); } },
};