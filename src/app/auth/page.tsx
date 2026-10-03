"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import BrickLogo from "@/components/BrickLogo";
import TapFig from "@/components/TapFig";
import Icon from "@/components/Icon";
import { GoogleMark } from "@/components/Icon";
import { resetTheme } from "@/lib/theme";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // "newpass": back from a password-reset email, choosing a new password
  const [mode, setMode] = useState<"signup" | "signin" | "newpass">(() => {
    if (typeof window !== "undefined" && /type=recovery/.test(window.location.hash)) return "newpass";
    const m = searchParams.get("mode");
    return m === "signin" ? "signin" : m === "newpass" ? "newpass" : "signup";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const proceeding = useRef(false);

  useEffect(() => {
    resetTheme();
    // a recovery link signs you in just to set a new password: stay here
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("newpass");
    });
    if (mode !== "newpass") {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session && !proceeding.current && !/type=recovery/.test(window.location.hash)) {
          proceeding.current = true;
          router.replace("/app");
        }
      });
    }
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, [router]);

  async function forgot() {
    setError(null);
    setNotice(null);
    if (!/.+@.+..+/.test(email)) {
      setError("Type your email above first, then tap Forgot password.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth?mode=newpass` });
    setBusy(false);
    if (error) setError(error.message);
    else setNotice("Check your inbox: we sent a link to choose a new password.");
  }

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
      if (mode === "newpass") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        router.replace("/app");
        return;
      }
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
        <h1 className="display tt-text text-[32px] mt-6">{mode === "signup" ? "Join the town" : mode === "newpass" ? "A new password" : "Welcome back"}</h1>
        <p className="text-[14px] font-bold text-[var(--ink)] mt-1">
          {mode === "signup" ? "Make your minifig and start building." : mode === "newpass" ? "Choose one, then you're straight back in." : "Your town missed you."}
        </p>
      </div>

      <div className="flex justify-end pr-6 -mb-[14px] mt-4 relative z-10">
        <TapFig character={mode === "signup" ? "wizard" : "warrior"} level={3} size={96} />
      </div>
      <section className="card tile-studs p-5">
        {mode !== "newpass" && (
          <>
            <button className="btn-ghost w-full py-3.5 gap-2.5" onClick={googleSignIn}>
              <GoogleMark />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mt-5">
              <span className="flex-1 h-[2px] rounded" style={{ background: "var(--line)" }} />
              <span className="hud-label">or with email</span>
              <span className="flex-1 h-[2px] rounded" style={{ background: "var(--line)" }} />
            </div>
          </>
        )}

        <form onSubmit={submit} className={`${mode === "newpass" ? "" : "mt-4"} flex flex-col gap-3`}>
          {mode !== "newpass" && (
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
          )}
          <input
            type="password"
            required
            minLength={6}
            placeholder={mode === "newpass" ? "New password (6+ characters)" : "Password (6+ characters)"}
            aria-label={mode === "newpass" ? "New password" : "Password"}
            value={password}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)}
            className="field px-4 py-3.5 text-[16px]"
          />
          {mode === "signin" && (
            <button type="button" className="self-end text-[13px] font-extrabold underline underline-offset-4 -mt-1" style={{ color: "var(--lego-blue)" }} onClick={forgot} disabled={busy}>
              Forgot password?
            </button>
          )}
          {error && <p className="text-sm font-bold px-1" style={{ color: "var(--danger)" }}>{error}</p>}
          {notice && <p className="chip chip-green !whitespace-normal !py-1.5">{notice}</p>}
          <button type="submit" className="btn-primary py-4 mt-3 !text-[18px]" disabled={busy}>
            {busy ? "One moment..." : mode === "signup" ? "Create my account" : mode === "newpass" ? "Save and go in" : "Sign in"}
          </button>
        </form>
      </section>

      {mode !== "newpass" && (
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
      )}
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
