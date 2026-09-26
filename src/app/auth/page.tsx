"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PENDING_KEY } from "@/lib/onboarding";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const proceeding = useRef(false);

  async function proceed() {
    if (proceeding.current) return;
    proceeding.current = true;
    try {
      let pending: string | null = null;
      try {
        pending = localStorage.getItem(PENDING_KEY);
      } catch {}
      if (pending) {
        const payload = JSON.parse(pending);
        const { error: rpcError } = await supabase.rpc("complete_onboarding", { p: payload });
        if (rpcError) {
          setError(`Could not save your plan: ${rpcError.message}`);
          proceeding.current = false;
          return;
        }
        try {
          localStorage.removeItem(PENDING_KEY);
        } catch {}
        router.replace("/paywall");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) {
        proceeding.current = false;
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", uid)
        .single();
      router.replace(profile?.onboarding_completed_at ? "/app" : "/onboarding");
    } catch (e) {
      setError(String(e));
      proceeding.current = false;
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) proceed();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          await proceed();
        } else {
          setNotice("Almost there. Check your inbox for a confirmation link, then sign in here.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await proceed();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col justify-center py-10">
      <div className="rise">
        <div className="hud-label mb-2">{mode === "signup" ? "Save your reset" : "Welcome back, challenger"}</div>
        <h1 className="text-3xl font-bold">
          {mode === "signup" ? "Create your account" : "Sign in"}
        </h1>
        <p className="text-muted mt-2">
          {mode === "signup"
            ? "Your plan, quests and progress are stored to your account."
            : "Pick up right where you left off."}
        </p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            className="card px-4 py-3.5 outline-none focus:border-[var(--accent)] placeholder:text-muted"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (6+ characters)"
            value={password}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            onChange={(e) => setPassword(e.target.value)}
            className="card px-4 py-3.5 outline-none focus:border-[var(--accent)] placeholder:text-muted"
          />
          {error && <p className="text-danger text-sm">{error}</p>}
          {notice && <p className="text-success text-sm">{notice}</p>}
          <button type="submit" className="btn-primary py-4 mt-2" disabled={busy}>
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          className="text-muted text-sm mt-6 underline underline-offset-4 w-full text-center"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setError(null);
          }}
        >
          {mode === "signup" ? "I already have an account" : "I need a new account"}
        </button>
      </div>
    </main>
  );
}
