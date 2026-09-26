import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import PwaSetup from "@/components/PwaSetup";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "Life Reset",
  description: "Reset your life. For real this time. Pure challenges: real habits become quests that pay XP, build streaks and climb ranks.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Life Reset",
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
      <body className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} antialiased`}>
        <PwaSetup />
        <div className="glow-scene" aria-hidden />
        <div className="mx-auto w-full max-w-md min-h-dvh flex flex-col px-4">
          {children}
        </div>
      </body>
    </html>
  );
}
