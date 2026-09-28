"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";

type SyncResult = Record<string, unknown> & { connected?: boolean; xpGained?: number };

async function bearer() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

// One connectable service (Google, WHOOP, …). Renders nothing until its backend
// reports it is configured, so a provider whose keys aren't set stays hidden.
function ProviderCard({
  provider,
  icon,
  title,
  blurb,
  summarize,
  onXp,
}: {
  provider: string;
  icon: string;
  title: string;
  blurb: string;
  summarize: (d: SyncResult) => string;
  onXp?: () => void;
}) {
  const [configured, setConfigured] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
        setMsg("Up to date — nothing new to reward yet.");
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
    } catch {
      setConnected(false);
    }
  }, [base]);

  useEffect(() => {
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
        <span className="icon-tile !w-10 !h-10 !rounded-[11px] text-muted">
          <Icon name={icon} size={18} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="hud-label mt-1 block">
            {connected === null ? "Checking…" : connected ? "Connected · earning XP" : blurb}
          </span>
        </span>
        <button
          className="btn-primary px-4 py-2 !text-xs whitespace-nowrap"
          disabled={busy || connected === null}
          onClick={connected ? sync : connect}
        >
          {connected ? (busy ? "Syncing…" : "Sync") : "Connect"}
        </button>
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

export default function Connections({ onXp }: { onXp?: () => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <ProviderCard
        provider="google"
        icon="calendar"
        title="Google Tasks & Calendar"
        blurb="Earn XP from your real tasks and plans"
        summarize={(d) =>
          `+${d.xpGained} XP from ${d.newTasks as number} task${d.newTasks === 1 ? "" : "s"} and ${d.newEvents as number} event${d.newEvents === 1 ? "" : "s"}.`
        }
        onXp={onXp}
      />
      <ProviderCard
        provider="whoop"
        icon="stat-con"
        title="WHOOP"
        blurb="Earn XP from recovery, sleep and workouts"
        summarize={(d) => `+${d.xpGained} XP from ${d.newItems as number} health record${d.newItems === 1 ? "" : "s"}.`}
        onXp={onXp}
      />
    </div>
  );
}
