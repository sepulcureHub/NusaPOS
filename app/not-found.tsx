import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card p-10 text-center max-w-lg mx-auto mt-10">
      <p className="font-display font-bold text-6xl text-grad">404</p>
      <h2 className="font-display font-bold text-xl mt-3">Halaman tidak ditemukan</h2>
      <p className="text-sm text-mute mt-2">Pulau yang kamu cari belum ada di peta Nusantara.</p>
      <Link href="/" className="btn btn-primary mt-5">Kembali ke Dashboard</Link>
    </div>
  );
}