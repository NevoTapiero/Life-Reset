"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BrickLogo from "@/components/BrickLogo";
import Icon from "@/components/Icon";
import TownArt from "@/components/TownArt";
import { resetTheme } from "@/lib/theme";

// the postcard town on the welcome screen: one of each character
const DEMO = [
  { name: "wizard", level: 4, character: "wizard", me: false },
  { name: "guardian", level: 3, character: "guardian", me: false },
  { name: "you", level: 5, character: "warrior", me: true },
  { name: "mentalist", level: 2, character: "mentalist", me: false },
  { name: "shadow", level: 3, character: "shadow", me: false },
];

const STEPS = [
  { icon: "check", brick: "var(--lego-green)", title: "Do your missions", body: "Real habits: training, sleep, reading, your tasks." },
  { icon: "home", brick: "var(--lego-orange)", title: "Build your world", body: "XP levels up your minifig, your house and your ride." },
  { icon: "users", brick: "var(--lego-blue)", title: "Play with friends", body: "One LEGO town, everyone's progress, one leaderboard." },
];

export default function Landing() {
  const router = useRouter();
  useEffect(() => {
    resetTheme();
    // already signed in: straight to Home
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/app");
    });
  }, [router]);
  return (
    <main className="flex-1 flex flex-col py-8">
      <div className="text-center rise">
        <BrickLogo />
        <p className="mt-5 display text-[20px]">Real habits build your LEGO world.</p>
      </div>

      <div className="scene mt-6 rise" style={{ animationDelay: "80ms" }}>
        <TownArt residents={DEMO} className="w-full h-auto block" />
      </div>

      <div className="flex flex-col gap-2.5 mt-6 stagger">
        {STEPS.map((s) => (
          <div key={s.title} className="card px-4 py-3 flex items-center gap-3.5">
            <span className="grid place-items-center rounded-[12px] flex-none text-white" style={{ width: 42, height: 42, background: s.brick, boxShadow: "inset 0 -3px 0 rgb(0 0 0 / 0.2)" }}>
              <Icon name={s.icon} size={20} strokeWidth={2.4} />
            </span>
            <span>
              <span className="display block text-[17px]">{s.title}</span>
              <span className="block text-[13px] font-bold text-muted">{s.body}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 mt-auto pt-8 rise">
        <Link href="/auth" className="btn-primary brick-yellow py-4 !text-[19px]">
          Start playing
          <Icon name="arrow-right" size={18} strokeWidth={2.6} />
        </Link>
        <Link href="/auth?mode=signin" className="btn-ghost py-3.5">
          I already have an account
        </Link>
      </div>
    </main>
  );
}
