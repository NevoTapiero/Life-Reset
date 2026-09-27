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
