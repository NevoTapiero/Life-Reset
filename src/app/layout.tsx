import type { Metadata, Viewport } from "next";
import { Fredoka, Geist_Mono, Nunito } from "next/font/google";
import PwaSetup from "@/components/PwaSetup";
import "./globals.css";

// Headings: round, chunky, friendly (a LEGO game menu)
const fredoka = Fredoka({
  variable: "--font-brick",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Body: rounded and very readable at small sizes
const nunito = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Solo Leveling",
  description: "Real habits become quests. Earn XP, build your LEGO world, climb with your friends.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Solo Leveling",
  },
};

export const viewport: Viewport = {
  themeColor: "#7fb3ea",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fredoka.variable} ${nunito.variable} ${geistMono.variable} antialiased`}>
        <PwaSetup />
        <div className="glow-scene" aria-hidden />
        <div className="mx-auto w-full max-w-md min-h-dvh flex flex-col px-4">
          {children}
        </div>
      </body>
    </html>
  );
}
