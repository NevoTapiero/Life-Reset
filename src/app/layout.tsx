import type { Metadata, Viewport } from "next";
import { Anton, Archivo, Geist_Mono } from "next/font/google";
import PwaSetup from "@/components/PwaSetup";
import "./globals.css";

// In-app voice: wide, heavy, geometric (Monument Extended vibe)
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// Marketing voice: tall ultra-condensed block lettering
const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Solo Leveling",
  description: "Real habits become quests. Earn XP, keep the streak, climb the ranks.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Solo Leveling",
  },
};

export const viewport: Viewport = {
  themeColor: "#07090f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Paint the last-used character accent before first paint, so the app
            never flashes the default orange before the theme loads. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(location.pathname.indexOf('/app')!==0)return;var a=localStorage.getItem('sl-accent'),b=localStorage.getItem('sl-accent2');if(!a)return;function t(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(function(c){return c+c}).join('');var n=parseInt(h,16);return((n>>16)&255)+' '+((n>>8)&255)+' '+(n&255)}var s=document.documentElement.style;s.setProperty('--accent',a);s.setProperty('--accent-rgb',t(a));if(b){s.setProperty('--accent-2',b);s.setProperty('--accent-2-rgb',t(b))}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${archivo.variable} ${anton.variable} ${geistMono.variable} antialiased`}>
        <PwaSetup />
        <div className="glow-scene" aria-hidden />
        <div className="mx-auto w-full max-w-md min-h-dvh flex flex-col px-4">
          {children}
        </div>
      </body>
    </html>
  );
}
