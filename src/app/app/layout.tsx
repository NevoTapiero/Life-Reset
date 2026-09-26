"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TABS = [
  { href: "/app", label: "Today", icon: "⚔️" },
  { href: "/app/stats", label: "Stats", icon: "📊" },
  { href: "/app/leaderboard", label: "Board", icon: "🏆" },
  { href: "/app/profile", label: "Profile", icon: "🎮" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/auth");
      else setAuthed(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/auth");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!authed) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="hud-label pulse-glow">Loading The System…</div>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 pb-24 pt-5">{children}</main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-4 z-40">
        <div className="card flex justify-around py-2.5 backdrop-blur bg-[color-mix(in_srgb,var(--panel)_88%,transparent)]">
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg ${active ? "text-accent" : "text-muted"}`}
              >
                <span aria-hidden>{t.icon}</span>
                <span className="hud-label" style={active ? { color: "var(--accent)" } : undefined}>
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
