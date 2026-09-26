"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Landing() {
  const [showWhat, setShowWhat] = useState(false);
  const [members, setMembers] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .rpc("get_member_count")
      .then(({ data }) => setMembers(typeof data === "number" ? data : Number(data ?? 0)));
  }, []);

  return (
    <main className="flex-1 flex flex-col justify-between py-10">
      <div className="rise">
        <div className="hud-label text-center">
          {members !== null && members >= 100
            ? `${members.toLocaleString()} challengers inside`
            : "Founding cohort now open"}
        </div>
        <div className="mt-1 flex justify-center gap-0.5 text-gold text-sm" aria-hidden>
          ★★★★★
        </div>
      </div>

      <div className="text-center rise">
        <div className="text-6xl mb-6" aria-hidden>
          ⚔️
        </div>
        <h1 className="text-4xl font-bold leading-tight">
          Reset your life.
          <br />
          <span className="text-accent glow-accent">For real this time.</span>
        </h1>
        <p className="mt-4 text-muted text-lg">
          Become the main character of your life. A 66 day system that turns real habits into
          quests, XP and ranks.
        </p>
        <button className="mt-4 text-accent underline underline-offset-4" onClick={() => setShowWhat(true)}>
          What is Life Reset?
        </button>
      </div>

      <div className="flex flex-col gap-3 rise">
        <Link href="/onboarding" className="btn-primary text-center py-4 text-lg">
          Start my reset
        </Link>
        <Link href="/auth" className="btn-ghost text-center py-3.5">
          I already have an account
        </Link>
      </div>

      {showWhat && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end justify-center z-50"
          onClick={() => setShowWhat(false)}
        >
          <div
            className="card w-full max-w-md m-4 p-6 rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hud-label mb-4">What is Life Reset?</div>
            <ul className="space-y-4 text-ink">
              <li className="flex gap-3">
                <span aria-hidden>🩻</span>
                <span>A short assessment of where you actually are right now.</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden>🗺️</span>
                <span>A 66 day program built from your answers, not a template.</span>
              </li>
              <li className="flex gap-3">
                <span aria-hidden>🎮</span>
                <span>Quests, XP and ranks, so the work of changing feels like progress.</span>
              </li>
            </ul>
            <button className="btn-primary w-full py-3.5 mt-6" onClick={() => setShowWhat(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
