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
      if (!data.session) {
        router.replace("/auth");
        return;
      }
      setAuthed(true);
      // redeem a pending invite-link code from before sign-in
      let code: string | null = null;
      try {
        code = localStorage.getItem("sl-pending-code");
        if (code) localStorage.removeItem("sl-pending-code");
      } catch {}
      if (code) {
        supabase.rpc("add_friend", { p_code: code }).then(() => router.replace("/app/leaderboard"));
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/auth");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!authed) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="hud-label pulse-glow">Loading…</div>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 pb-28 pt-5">{children}</main>
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-4 z-40"
        style={{ willChange: "transform" }}
      >
        <div
          className="relative flex py-2.5 rounded-full border border-line"
          style={{
            background: "color-mix(in srgb, var(--panel) 85%, transparent)",
            backdropFilter: "blur(18px)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
          }}
        >
          {/* springy bubble: pokes above the bar and lands with a bounce */}
          <div
            aria-hidden
            className="absolute inset-y-0 flex items-center justify-center"
            style={{
              width: `${100 / TABS.length}%`,
              transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
              transition: "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              opacity: activeIndex < 0 ? 0 : 1,
            }}
          >
            <span
              className="block rounded-full"
              style={{
                width: 54,
                height: 54,
                transform: "translateY(-13px)",
                background: "linear-gradient(180deg, var(--accent-2), var(--accent))",
                boxShadow:
                  "0 6px 22px rgba(255,107,0,0.55), 0 0 0 5px var(--bg), inset 0 1px 0 rgba(255,255,255,0.3)",
              }}
            />
          </div>
          {TABS.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-label={t.label}
                className="relative flex-1 flex items-center justify-center py-2.5 active:scale-90"
                style={{
                  color: active ? "#fff" : "var(--muted)",
                  transform: active ? "translateY(-13px)" : "none",
                  transition: "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1), color 200ms ease",
                }}
              >
                <Icon name={t.icon} size={23} strokeWidth={active ? 2 : 1.7} />
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
