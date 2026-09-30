"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GoogleHealthMark, GoogleMark, WhoopMark } from "@/components/Icon";

type SyncResult = Record<string, unknown> & { connected?: boolean; xpGained?: number };

async function bearer() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

// One connectable service (Google, WHOOP, …). Renders nothing until its backend
// reports it is configured, so a provider whose keys aren't set stays hidden.
function ProviderCard({
  provider,
  mark,
  title,
  blurb,
  summarize,
  onXp,
}: {
  provider: string;
  mark: React.ReactNode;
  title: string;
  blurb: string;
  summarize: (d: SyncResult) => string;
  onXp?: () => void;
}) {
  const [configured, setConfigured] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);

  const base = `/api/integrations/${provider}`;

  const sync = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${base}/sync`, { method: "POST", headers: { Authorization: `Bearer ${await bearer()}` } });
      const d: SyncResult = await r.json();
      if (d.connected === false) {
        setConnected(false);
        setMsg("Please reconnect.");
      } else if ((d.xpGained ?? 0) > 0) {
        setMsg(summarize(d));
        onXp?.();
      } else {
        setMsg("Up to date, nothing new to reward yet.");
      }
    } catch {
      setMsg("Sync failed, try again.");
    }
    setBusy(false);
  }, [base, summarize, onXp]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${base}/status`, { headers: { Authorization: `Bearer ${await bearer()}` } });
      const d = await r.json();
      if (d.configured === false) {
        setConfigured(false);
        return;
      }
      setConnected(!!d.connected);
      // an older Google connection can read tasks but not tick them off
      setNeedsUpgrade(!!d.connected && d.canWrite === false);
    } catch {
      setConnected(false);
    }
  }, [base]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server, then sets state
    refresh();
    const p = new URLSearchParams(window.location.search);
    const g = p.get(provider);
    if (g) {
      window.history.replaceState({}, "", window.location.pathname);
      if (g === "connected") {
        setConnected(true);
        setMsg("Connected. Syncing…");
        sync();
      } else if (g === "denied") setMsg("Connection cancelled.");
      else if (g === "error") setMsg("Could not connect, try again.");
    }
  }, [refresh, sync, provider]);

  async function connect() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${base}/start`, { method: "POST", headers: { Authorization: `Bearer ${await bearer()}` } });
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
    await fetch(`${base}/disconnect`, { method: "POST", headers: { Authorization: `Bearer ${await bearer()}` } });
    setConnected(false);
    setMsg(null);
    setBusy(false);
  }

  if (!configured) return null;

  return (
    <div className="card px-4 py-4">
      <div className="flex items-center gap-3.5">
        <span className="icon-tile !w-11 !h-11 !rounded-[12px] overflow-hidden !bg-white">{mark}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-extrabold">{title}</span>
          {connected ? (
            <span className="chip chip-green !text-[11px] !py-0 mt-1">Connected, earning XP</span>
          ) : (
            <span className="text-[12.5px] font-bold text-muted mt-0.5 block">{connected === null ? "Checking..." : blurb}</span>
          )}
        </span>
        <button
          className={`btn-primary brick-flat px-4 py-2 !text-[13px] whitespace-nowrap ${connected ? "" : "brick-yellow"}`}
          disabled={busy || connected === null}
          onClick={connected ? sync : connect}
        >
          {connected ? (busy ? "Syncing…" : "Sync") : "Connect"}
        </button>
      </div>
      {msg && <p className="text-[13px] font-bold mt-3" style={{ color: "var(--lego-green-edge)" }}>{msg}</p>}
      {needsUpgrade && (
        <button
          className="btn-ghost brick-flat w-full py-2.5 mt-3 !text-[13px]"
          disabled={busy}
          onClick={connect}
        >
          Reconnect to tick tasks from the app
        </button>
      )}
      {connected && (
        <button className="text-[12.5px] font-extrabold text-muted mt-3 underline underline-offset-4" disabled={busy} onClick={disconnect}>
          Disconnect
        </button>
      )}
    </div>
  );
}

export default function Connections({ onXp }: { onXp?: () => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <ProviderCard
        provider="google"
        mark={<GoogleMark size={21} />}
        title="Google Tasks & Calendar"
        blurb="Earn XP from your real tasks and plans"
        summarize={(d) => `+${d.xpGained} XP from ${d.newTasks as number} task${d.newTasks === 1 ? "" : "s"}.`}
        onXp={onXp}
      />
      <ProviderCard
        provider="ghealth"
        mark={<GoogleHealthMark size={24} />}
        title="Google Health"
        blurb="Earn XP from workouts, sleep and steps"
        summarize={(d) => `+${d.xpGained} XP from ${d.newItems as number} health record${d.newItems === 1 ? "" : "s"}.`}
        onXp={onXp}
      />
      <ProviderCard
        provider="whoop"
        mark={<WhoopMark size={30} />}
        title="WHOOP"
        blurb="Earn XP from recovery, sleep and workouts"
        summarize={(d) => `+${d.xpGained} XP from ${d.newItems as number} health record${d.newItems === 1 ? "" : "s"}.`}
        onXp={onXp}
      />
      {/* next in line; shown so players know what's coming */}
      <div className="card px-4 py-4 flex items-center gap-3.5 opacity-70">
        <span className="icon-tile !w-11 !h-11 !rounded-[12px] display text-[15px]" style={{ color: "var(--lego-orange)" }} aria-hidden>
          S
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-extrabold">Strava</span>
          <span className="text-[12.5px] font-bold text-muted block">Runs and rides, coming soon</span>
        </span>
        <span className="chip !text-[11px]">Soon</span>
      </div>
    </div>
  );
}
