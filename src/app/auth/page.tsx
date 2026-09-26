"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import { GoogleMark } from "@/components/Icon";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const proceeding = useRef(false);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("mode") === "signin") {
        setMode("signin");
      }
    } catch {}
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !proceeding.current) {
        proceeding.current = true;
        router.replace("/app");
      }
    });
  }, [router]);

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
          router.replace("/app");
        } else {
          setNotice("Check your inbox for a confirmation link, then sign in here.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/app");
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
        <div className="flex justify-center mb-6">
          <Avatar size={84} />
        </div>
        <div className="text-center">
          <span className="eyebrow hud-label !text-ink">
            {mode === "signup" ? "Save your reset" : "Welcome back, challenger"}
          </span>
          <h1 className="display text-3xl mt-4">
            {mode === "signup" ? "CREATE YOUR ACCOUNT" : "SIGN IN"}
          </h1>
          <p className="text-muted mt-2 text-sm">
            {mode === "signup"
              ? "Your quests, XP and streaks are stored to your account."
              : "Pick up right where you left off."}
          </p>
        </div>

        <button className="btn-ghost w-full py-3.5 mt-8 gap-2.5" onClick={googleSignIn}>
          <GoogleMark />
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mt-5">
          <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
          <span className="hud-label">or with email</span>
          <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
        </div>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            className="field px-4 py-3.5 text-[15px]"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (6+ characters)"
            value={password}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            onChange={(e) => setPassword(e.target.value)}
            className="field px-4 py-3.5 text-[15px]"
          />
          {error && <p className="text-danger text-sm px-1">{error}</p>}
          {notice && <p className="text-accent text-sm px-1">{notice}</p>}
          <button type="submit" className="btn-primary py-4 mt-3" disabled={busy}>
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          className="text-muted text-sm mt-8 py-2 underline underline-offset-4 w-full text-center"
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
