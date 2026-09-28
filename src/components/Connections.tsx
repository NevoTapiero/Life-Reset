"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

// Connect Google (Tasks + Calendar): completing tasks and having a full calendar
// earn XP, judged by the same AI reviewer that rates quests.
export default function Connections({ onXp }: { onXp?: () => void }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const token = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/integrations/google/status", {
        headers: { Authorization: `Bearer ${await token()}` },
      });
      const d = await r.json();
      setConnected(!!d.connected);
    } catch {
      setConnected(false);
    }
  }, [token]);

  const sync = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/integrations/google/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}` },
      });
      const d = await r.json();
      if (d.connected === false) {
        setConnected(false);
        setMsg("Please reconnect Google.");
      } else if (d.xpGained > 0) {
        setMsg(`+${d.xpGained} XP from ${d.newTasks} task${d.newTasks === 1 ? "" : "s"} and ${d.newEvents} event${d.newEvents === 1 ? "" : "s"}.`);
        onXp?.();
      } else {
        setMsg("Up to date — nothing new to reward yet.");
      }
    } catch {
      setMsg("Sync failed, try again.");
    }
    setBusy(false);
  }, [token, onXp]);

  useEffect(() => {
    refresh();
    // returning from the Google consent screen
    const p = new URLSearchParams(window.location.search);
    const g = p.get("google");
    if (g) {
      window.history.replaceState({}, "", window.location.pathname);
      if (g === "connected") {
        setConnected(true);
        setMsg("Google connected. Syncing…");
        sync();
      } else if (g === "denied") {
        setMsg("Google connection was cancelled.");
      } else if (g === "error") {
        setMsg("Could not connect Google, try again.");
      }
    }
  }, [refresh, sync]);

  async function connect() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/integrations/google/start", {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}` },
      });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
      else {
        setMsg("Could not start, try again.");
        setBusy(false);
      }
    } catch {
      setMsg("Could not start, try again.");
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    await fetch("/api/integrations/google/disconnect", {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}` },
    });
    setConnected(false);
    setMsg(null);
    setBusy(false);
  }

  return (
    <div className="card px-4 py-4">
      <div className="flex items-center gap-3.5">
        <span className="icon-tile !w-10 !h-10 !rounded-[11px] text-muted">
          <Icon name="calendar" size={18} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold">Google Tasks & Calendar</span>
          <span className="hud-label mt-1 block">
            {connected === null ? "Checking…" : connected ? "Connected · earn XP for what you get done" : "Earn XP from your real tasks and plans"}
          </span>
        </span>
        {connected ? (
          <button className="btn-primary px-4 py-2 !text-xs whitespace-nowrap" disabled={busy} onClick={sync}>
            {busy ? "Syncing…" : "Sync"}
          </button>
        ) : (
          <button className="btn-primary px-4 py-2 !text-xs whitespace-nowrap" disabled={busy || connected === null} onClick={connect}>
            Connect
          </button>
        )}
      </div>
      {msg && <p className="text-sm mt-3" style={{ color: "var(--accent)" }}>{msg}</p>}
      {connected && (
        <button className="hud-label mt-3 underline underline-offset-4" disabled={busy} onClick={disconnect}>
          Disconnect
        </button>
      )}
    </div>
  );
}
