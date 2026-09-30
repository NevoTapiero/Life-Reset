"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resetTheme } from "@/lib/theme";
import LegoIcon, { BrickColor } from "@/components/LegoIcon";
import BrickLoader from "@/components/BrickLoader";

// Three screens outside the LEGO world: Home (your missions and apps), World
// (the board and the door into the 3D town) and Profile (the dry stuff).
const TABS = [
  { href: "/app", label: "Home", icon: "home", color: "blue", match: (p: string) => p === "/app" || p.startsWith("/app/quests") || p.startsWith("/app/missions") },
  { href: "/app/world", label: "World", icon: "globe", color: "green", match: (p: string) => p.startsWith("/app/world") || p.startsWith("/app/leaderboard") },
  { href: "/app/profile", label: "Profile", icon: "user", color: "yellow", match: (p: string) => p.startsWith("/app/profile") || p.startsWith("/app/stats") },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);
  // friends knocking on your door, shown as a badge on World
  const [knocks, setKnocks] = useState(0);

  useEffect(() => {
    resetTheme();
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
        supabase.rpc("add_friend", { p_code: code }).then(() => router.replace("/app/world"));
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/auth");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  // re-count on every screen change, and when a screen says a knock was answered
  useEffect(() => {
    if (!authed) return;
    const count = () =>
      supabase.rpc("my_visits").then(({ data }) => {
        const rows = (data as { knocked_by_me: boolean; allowed: boolean }[] | null) ?? [];
        setKnocks(rows.filter((v) => !v.knocked_by_me && !v.allowed).length);
      });
    count();
    window.addEventListener("sl-knocks", count);
    return () => window.removeEventListener("sl-knocks", count);
  }, [authed, pathname]);

  if (!authed) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <BrickLoader label="Loading" />
      </main>
    );
  }

  // Inside the 3D world the town takes the whole screen; a friend's page is a
  // focused view. Neither shows the bar.
  const inWorld = pathname.startsWith("/app/town");
  const hideNav = inWorld || pathname.startsWith("/app/friend/");

  if (inWorld) {
    return (
      <main className="world-play fixed inset-0 z-30 bg-[var(--bg-top)]">
        {children}
      </main>
    );
  }

  return (
    <>
      <main className={`flex-1 pt-4 ${hideNav ? "pb-8" : "pb-32"}`}>{children}</main>
      {!hideNav && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-4 z-40" aria-label="Main">
          <div className="brick-nav">
            {TABS.map((t) => {
              const on = t.match(pathname);
              return (
                <Link key={t.href} href={t.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
                  <span className="relative">
                    <LegoIcon name={t.icon} color={on ? (t.color as BrickColor) : "grey"} size={on ? 36 : 32} />
                    {t.href === "/app/world" && knocks > 0 && (
                      <span className="absolute -right-2 -top-1.5 min-w-[17px] h-[17px] px-1 rounded-full grid place-items-center text-[10px] font-black text-white" style={{ background: "var(--lego-red)", boxShadow: "0 0 0 2px #fff" }} aria-label={`${knocks} knocking`}>
                        {knocks}
                      </span>
                    )}
                  </span>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
