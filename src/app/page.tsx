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
            ? `${members.toLocaleString()} hunters inside`
            : "Founding cohort now open"}
        </span>
      </div>

      <div className="my-auto py-8 text-center rise">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <Avatar size={148} />
            <span
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 hud-label !text-ink bg-panel border border-line rounded-full px-3 py-1"
              style={{ borderColor: "rgba(255,107,0,0.5)" }}
            >
              Hunter
            </span>
          </div>
        </div>

        <h1 className="display-hero text-[76px] leading-[0.92]">
          SOLO
          <br />
          <span
            className="text-accent"
            style={{ textShadow: "0 0 38px rgba(255,107,0,0.55)" }}
          >
            LEVELING
          </span>
        </h1>
        <p className="mt-5 text-muted text-[15px] max-w-xs mx-auto">
          Real habits. Real XP. Level up in real life.
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

      <div className="flex flex-col gap-4 rise pb-3 pt-4">
        <Link href="/auth" className="btn-primary py-4 text-[15px]">
          Start leveling
          <span className="btn-icon-slot">
            <Icon name="arrow-right" size={14} strokeWidth={2} />
          </span>
        </Link>
        <Link href="/auth?mode=signin" className="btn-ghost py-3.5">
          I already have an account
        </Link>
        <p className="text-center hud-label mt-1.5">Free forever</p>
      </div>
    </main>
  );
}
