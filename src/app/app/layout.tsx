"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

const TABS = [
  { href: "/app", label: "Today", icon: "tasks" },
  { href: "/app/quests", label: "Quests", icon: "sliders" },
  { href: "/app/stats", label: "Stats", icon: "chart" },
  { href: "/app/leaderboard", label: "Board", icon: "trophy" },
  { href: "/app/profile", label: "Profile", icon: "user" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const activeIndex = TABS.findIndex((t) => t.href === pathname);

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
          className="relative flex py-2 rounded-full border border-line overflow-hidden"
          style={{
            background: "color-mix(in srgb, var(--panel) 82%, transparent)",
            backdropFilter: "blur(18px)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* sliding active pill */}
          <div
            aria-hidden
            className="absolute top-1.5 bottom-1.5 rounded-full"
            style={{
              width: `${100 / TABS.length}%`,
              transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
              transition: "transform 320ms var(--ease-drawer)",
              background: "rgba(255, 107, 0, 0.10)",
              border: "1px solid rgba(255, 107, 0, 0.35)",
              opacity: activeIndex < 0 ? 0 : 1,
            }}
          />
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className="relative flex-1 flex flex-col items-center gap-1 py-1.5 transition-transform duration-150 active:scale-95"
                style={{ color: active ? "var(--accent)" : "var(--muted)" }}
              >
                <span key={active ? "on" : "off"} className={active ? "check-pop" : undefined}>
                  <Icon name={t.icon} size={20} strokeWidth={active ? 1.9 : 1.6} />
                </span>
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
