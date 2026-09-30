"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { resetTheme } from "@/lib/theme";
import Icon from "@/components/Icon";
import BrickLoader from "@/components/BrickLoader";

// Three screens outside the LEGO world: Home (your missions and apps), World
// (the board and the door into the 3D town) and Profile (the dry stuff).
const TABS = [
  { href: "/app", label: "Home", icon: "home", match: (p: string) => p === "/app" || p.startsWith("/app/quests") || p.startsWith("/app/missions") },
  { href: "/app/world", label: "World", icon: "globe", match: (p: string) => p.startsWith("/app/world") || p.startsWith("/app/leaderboard") },
  { href: "/app/profile", label: "Profile", icon: "user", match: (p: string) => p.startsWith("/app/profile") || p.startsWith("/app/stats") },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState<boolean | null>(null);

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
        {/* the way back out, under the player card (the joystick lives bottom left) */}
        <Link href="/app/world" className="world-back" aria-label="Back to World">
          <Icon name="chevron-left" size={17} strokeWidth={2.6} />
          World
        </Link>
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
                  <Icon name={t.icon} size={22} strokeWidth={on ? 2.3 : 2} />
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
