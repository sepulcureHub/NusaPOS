import type { NextConfig } from "next";

/**
 * NusaPOS — konfigurasi build yang tahan mesin RAM terbatas.
 *
 * Default Next 16: experimental.cpus = os.cpus().length - 1.
 * Di mesin 12 thread itu jadi 11 worker untuk fase "Collecting page data",
 * masing-masing mengimpor semua route module → commit charge Windows habis
 * → worker mati dengan "NewSpace::EnsureCurrentCapacity Allocation failed".
 *
 * Di sini jumlah worker dipatok kecil dan bisa dioverride lewat env
 * tanpa perlu mengubah kode:
 *   NEXT_BUILD_CPUS=1              → paling aman (lambat tapi pasti jalan)
 *   NEXT_BUILD_PAGE_CONCURRENCY=2  → prerender lebih hemat memori
 *   NEXT_TURBO_FS_CACHE=0          → matikan cache filesystem Turbopack
 */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

const BUILD_CPUS = envInt("NEXT_BUILD_CPUS", 2);
const PAGE_CONCURRENCY = envInt("NEXT_BUILD_PAGE_CONCURRENCY", 4);
const TURBO_FS_CACHE = process.env.NEXT_TURBO_FS_CACHE !== "0";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  experimental: {
    // Jumlah worker pengumpul page data & static generation.
    cpus: BUILD_CPUS,

    // Sengaja false: kita mau angka yang deterministik dan bisa direproduksi,
    // bukan tebakan berdasarkan free memory yang berubah-ubah.
    memoryBasedWorkersCount: false,

    // Fork process, bukan worker_threads: heap tiap worker terpisah dan
    // tidak menumpuk di satu address space proses induk.
    workerThreads: false,

    // Default Next 8. Turunkan supaya prerender tidak menumpuk.
    staticGenerationMaxConcurrency: PAGE_CONCURRENCY,

    turbopackFileSystemCacheForBuild: TURBO_FS_CACHE,
  },
};

export default nextConfig;