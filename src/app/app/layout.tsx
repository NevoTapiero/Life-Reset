"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

const TABS = [
  { href: "/app", label: "Today", icon: "swords" },
  { href: "/app/quests", label: "Quests", icon: "sliders" },
  { href: "/app/stats", label: "Stats", icon: "chart" },
  { href: "/app/leaderboard", label: "Board", icon: "trophy" },
  { href: "/app/profile", label: "Profile", icon: "user" },
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
      <main className="flex-1 pb-28 pt-5">{children}</main>
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-4 z-40">
        <div
          className="flex justify-around py-2 rounded-full border border-line"
          style={{
            background: "color-mix(in srgb, var(--panel) 82%, transparent)",
            backdropFilter: "blur(18px)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          }}
        >
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-2xl transition-transform duration-150 active:scale-95"
                style={{ color: active ? "var(--accent)" : "var(--muted)" }}
              >
                <Icon name={t.icon} size={20} strokeWidth={active ? 1.9 : 1.6} />
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
