import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/components/Toasts";
import { Shell } from "@/components/Shell";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex" });

export const metadata: Metadata = {
  title: { default: "NusaPOS — Sistem Kasir Digital Nusantara", template: "%s • NusaPOS" },
  description: "Sistem Point of Sale untuk UMKM Indonesia: kasir, produk, transaksi, refund, dan analitik penjualan real-time.",
};

export const viewport: Viewport = { themeColor: "#06181b" };

const noFlash = `(function(){try{var r=localStorage.getItem("nusapos:v1");if(!r)return;var p=JSON.parse(r);var s=p&&p.state&&p.state.settings;if(!s)return;var m=s.theme||"dark";if(m==="system"){m=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}document.documentElement.dataset.theme=m;document.documentElement.dataset.accent=s.accent||"tosca";var t=document.querySelector('meta[name="theme-color"]');if(t)t.setAttribute("content",m==="light"?"#e8efee":"#06181b");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${jakarta.variable} ${grotesk.variable} ${plex.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
        <ToastProvider>
          <StoreProvider>
            <Shell>{children}</Shell>
          </StoreProvider>
        </ToastProvider>
      </body>
    </html>
  );
}