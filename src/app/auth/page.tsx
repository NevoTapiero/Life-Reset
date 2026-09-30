"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import BrickLogo from "@/components/BrickLogo";
import Minifig from "@/components/Minifig";
import Icon from "@/components/Icon";
import { GoogleMark } from "@/components/Icon";
import { resetTheme } from "@/lib/theme";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signup" | "signin">(
    searchParams.get("mode") === "signin" ? "signin" : "signup"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const proceeding = useRef(false);

  useEffect(() => {
    // auth screens keep the original orange theme, never the character color
    resetTheme();
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
    <div className="rise my-auto">
      <div className="text-center">
        <BrickLogo size={0.8} />
        <h1 className="display text-[30px] mt-6">{mode === "signup" ? "Join the town" : "Welcome back"}</h1>
        <p className="text-[14px] font-bold text-muted mt-1">
          {mode === "signup" ? "Make your minifig and start building." : "Your town missed you."}
        </p>
      </div>

      <div className="flex justify-end pr-6 -mb-[14px] mt-4 relative z-10" aria-hidden>
        <Minifig character={mode === "signup" ? "wizard" : "warrior"} level={3} size={96} />
      </div>
      <section className="card tile-studs p-5">
        <button className="btn-ghost w-full py-3.5 gap-2.5" onClick={googleSignIn}>
          <GoogleMark />
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mt-5">
          <span className="flex-1 h-[2px] rounded" style={{ background: "var(--line)" }} />
          <span className="hud-label">or with email</span>
          <span className="flex-1 h-[2px] rounded" style={{ background: "var(--line)" }} />
        </div>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            aria-label="Email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            className="field px-4 py-3.5 text-[16px]"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (6+ characters)"
            aria-label="Password"
            value={password}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            onChange={(e) => setPassword(e.target.value)}
            className="field px-4 py-3.5 text-[16px]"
          />
          {error && <p className="text-sm font-bold px-1" style={{ color: "var(--danger)" }}>{error}</p>}
          {notice && <p className="chip chip-green !whitespace-normal !py-1.5">{notice}</p>}
          <button type="submit" className="btn-primary py-4 mt-3 !text-[18px]" disabled={busy}>
            {busy ? "One moment..." : mode === "signup" ? "Create my account" : "Sign in"}
          </button>
        </form>
      </section>

      <button
        className="text-[14px] font-extrabold mt-6 py-2 underline underline-offset-4 w-full text-center"
        style={{ color: "var(--lego-blue)" }}
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setError(null);
        }}
      >
        {mode === "signup" ? "I already have an account" : "I need a new account"}
      </button>
    </div>
  );
}

export default function AuthPage() {
  return (
    <main className="flex-1 flex flex-col py-8">
      <Link href="/" className="self-start icon-tile !w-10 !h-10 !bg-white" aria-label="Back">
        <Icon name="chevron-left" size={20} strokeWidth={2.4} />
      </Link>
      <Suspense fallback={null}>
        <AuthForm />
      </Suspense>
    </main>
  );
}
