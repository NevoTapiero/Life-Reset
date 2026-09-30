"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Invite link: /join/ABC123. Signed in -> add the friend and open the board.
// Signed out -> remember the code, send them through auth; the app layout
// redeems it right after their first sign-in.
export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    const code = decodeURIComponent(params.code ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    if (code.length < 4) {
      router.replace("/");
      return;
    }
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await supabase.rpc("add_friend", { p_code: code });
        router.replace("/app/world");
      } else {
        try {
          localStorage.setItem("sl-pending-code", code);
        } catch {}
        router.replace("/auth");
      }
    })();
  }, [params.code, router]);

  return <div className="hud-label pulse-glow text-center py-20">Opening invite…</div>;
}
