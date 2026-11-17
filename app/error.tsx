"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card p-10 text-center max-w-lg mx-auto mt-10">
      <div className="text-4xl mb-3">🌊</div>
      <h2 className="font-display font-bold text-xl">Aduh, ada ombak error</h2>
      <p className="text-sm text-mute mt-2 break-words">{error.message || "Terjadi kesalahan tak terduga."}</p>
      <button onClick={reset} className="btn btn-primary mt-5">Coba Lagi</button>
    </div>
  );
}