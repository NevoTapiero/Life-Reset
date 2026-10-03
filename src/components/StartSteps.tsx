"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

const KEY = "sl-start-steps-hidden";

// Getting started, drawn like a page of LEGO building instructions: numbered
// steps in boxes, a tick when each is done. Shown to new players until all
// three are built (or they hide it).
export default function StartSteps({ doneCount }: { doneCount: number }) {
  const [state, setState] = useState<{ friends: number; apps: number } | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    // one onboarding card at a time: wait while "How it works" is still up
    const read = () => {
      try {
        setHidden(localStorage.getItem(KEY) === "1" || localStorage.getItem("sl-tips-v1") !== "done");
      } catch {
        setHidden(false);
      }
    };
    read();
    window.addEventListener("sl-tips-done", read);
    Promise.all([supabase.rpc("get_leaderboard"), supabase.rpc("my_trackers")]).then(([lb, tr]) =>
      setState({ friends: Math.max(0, ((lb.data as unknown[]) ?? []).length - 1), apps: ((tr.data as unknown[]) ?? []).length }),
    );
    return () => window.removeEventListener("sl-tips-done", read);
  }, []);

  if (hidden || !state) return null;
  const steps = [
    { n: 1, title: "Check your first mission", done: doneCount > 0, href: null as string | null, cta: "" },
    { n: 2, title: "Connect an app", done: state.apps > 0, href: "/app/profile#apps", cta: "Connect" },
    { n: 3, title: "Invite a friend to your town", done: state.friends > 0, href: "/app/world", cta: "Invite" },
  ];
  if (steps.every((s) => s.done)) return null;

  function hide() {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  }

  return (
    <section className="instructions mt-4" aria-label="Getting started">
      <div className="flex items-center justify-between mb-2">
        <span className="display text-[17px]">Getting started</span>
        <button className="text-[12px] font-extrabold text-muted underline underline-offset-4" onClick={hide}>
          Hide
        </button>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s.n} className={`instructions-step ${s.done ? "done" : ""}`}>
            <span className="instructions-num">{s.done ? <Icon name="check" size={18} strokeWidth={3} /> : s.n}</span>
            <span className={`flex-1 font-extrabold text-[14.5px] ${s.done ? "line-through text-muted" : ""}`}>{s.title}</span>
            {!s.done && s.href && (
              <Link href={s.href} className="btn-primary brick-flat brick-yellow !text-[13px] px-3 py-1.5">
                {s.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
