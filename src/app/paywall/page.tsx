"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PaywallPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<"yearly" | "monthly">("yearly");
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/auth");
    });
  }, [router]);

  return (
    <main className="flex-1 flex flex-col py-8">
      <div className="rise flex-1">
        <div className="hud-label mb-2">Campaign 1 is ready</div>
        <h1 className="text-3xl font-bold leading-tight">
          Invest in yourself and make an epic comeback in 66 days.
        </h1>
        <p className="text-muted mt-3">
          Full access: your generated program, science based task planning, daily ritual and
          improvement tracking, ranks and the live board.
        </p>

        <div className="card p-4 mt-6 border-l-2 border-l-[var(--gold)]">
          <div className="font-semibold text-gold">Finish your reset, or it is free.</div>
          <p className="text-sm text-muted mt-1.5">
            Complete 70% of your 66 day plan and get 100% of your money back. You keep the
            subscription.
          </p>
          <button className="text-xs text-muted underline underline-offset-4 mt-2" onClick={() => setShowTerms(!showTerms)}>
            How it works
          </button>
          {showTerms && (
            <p className="text-xs text-muted mt-2">
              Complete at least 70% of all tasks in your 66 day program and submit your progress
              before the campaign deadline. You receive a full refund and keep full access.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 mt-6">
          <button
            className={`option-row p-4 flex items-center gap-3 ${plan === "yearly" ? "selected" : ""}`}
            onClick={() => setPlan("yearly")}
          >
            <span className="flex-1 text-left">
              <span className="block font-semibold">Yearly</span>
              <span className="block text-sm text-muted">₪12.49 per month, billed annually</span>
            </span>
            <span className="hud-label !text-gold border border-[var(--gold)] rounded-full px-2.5 py-1">Save 70%</span>
          </button>
          <button
            className={`option-row p-4 flex items-center gap-3 ${plan === "monthly" ? "selected" : ""}`}
            onClick={() => setPlan("monthly")}
          >
            <span className="flex-1 text-left">
              <span className="block font-semibold">Monthly</span>
              <span className="block text-sm text-muted">₪41.90 per month</span>
            </span>
          </button>
        </div>
      </div>

      <div className="pt-6 pb-2">
        <button className="btn-primary w-full py-4 text-lg" onClick={() => router.replace("/app")}>
          Start my reset
        </button>
        <p className="text-center text-xs text-muted mt-3">
          Founder preview: payments are not live yet, access is free while we build.
        </p>
      </div>
    </main>
  );
}
