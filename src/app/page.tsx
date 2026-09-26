"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";

export default function Landing() {
  const [members, setMembers] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .rpc("get_member_count")
      .then(({ data }) => setMembers(typeof data === "number" ? data : Number(data ?? 0)));
  }, []);

  return (
    <main className="flex-1 flex flex-col py-8">
      <div className="flex justify-center rise">
        <span className="eyebrow hud-label !text-ink">
          {members !== null && members >= 100
            ? `${members.toLocaleString()} challengers inside`
            : "Founding cohort now open"}
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center text-center rise">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <Avatar size={148} />
            <span
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 hud-label !text-ink bg-panel border border-line rounded-full px-3 py-1"
              style={{ borderColor: "rgba(255,107,0,0.5)" }}
            >
              Challenger
            </span>
          </div>
        </div>

        <h1 className="display text-[40px] leading-[1.05]">
          RESET YOUR
          <br />
          LIFE.{" "}
          <span
            className="text-accent"
            style={{ textShadow: "0 0 32px rgba(255,107,0,0.55)" }}
          >
            FOR REAL
          </span>
          <br />
          THIS TIME.
        </h1>
        <p className="mt-5 text-muted text-[15px] leading-relaxed max-w-xs mx-auto">
          Become the main character of your life. Pure challenges: real habits become quests
          that pay XP, build streaks and climb ranks.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-2.5 stagger">
          {[
            { icon: "swords", label: "Daily quests" },
            { icon: "flame", label: "Streaks" },
            { icon: "trophy", label: "Live ranks" },
          ].map((f) => (
            <div key={f.label} className="card py-3.5 flex flex-col items-center gap-2">
              <Icon name={f.icon} size={19} className="text-accent" />
              <span className="hud-label">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rise pb-2">
        <Link href="/auth" className="btn-primary py-4 text-[15px]">
          Start my reset
          <span className="btn-icon-slot">
            <Icon name="arrow-right" size={14} strokeWidth={2} />
          </span>
        </Link>
        <Link href="/auth?mode=signin" className="btn-ghost py-3.5">
          I already have an account
        </Link>
        <p className="text-center hud-label mt-1">Free for every challenger</p>
      </div>
    </main>
  );
}
