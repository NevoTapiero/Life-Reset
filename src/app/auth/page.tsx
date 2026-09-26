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
        router.replace("/app");
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

  async function googleSignIn() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) setError(error.message);
  }

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

        <button className="btn-ghost w-full py-3.5 mt-8 flex items-center justify-center gap-2.5" onClick={googleSignIn}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mt-5">
          <div className="flex-1 h-px bg-line" />
          <span className="hud-label">or with email</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
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
