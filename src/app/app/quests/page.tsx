"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import { PILLARS, PILLAR_ICONS, PILLAR_STAT, Pillar, Quest } from "@/lib/game";

type FormState = { id: string | null; title: string; pillar: Pillar };
const EMPTY_FORM: FormState = { id: null, title: "", pillar: "Strength" };
const NONSENSE_MSG = "This quest doesn't make sense or can't be done. Rewrite it and try again.";

// screen time: tighter limit, bigger reward
const SCREEN_LIMITS = [
  { minutes: 30, label: "30 min", xp: 60 },
  { minutes: 60, label: "1 hour", xp: 50 },
  { minutes: 90, label: "90 min", xp: 40 },
  { minutes: 120, label: "2 hours", xp: 30 },
];

export default function QuestManager() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [uid, setUid] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [stForm, setStForm] = useState<{ app: string; minutes: number } | null>(null);
  const [verdict, setVerdict] = useState<{ title: string; xp: number; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    setUid(userId);
    if (!userId) return;
    const [{ data: qs }, { data: uq }] = await Promise.all([
      supabase.from("quests").select("*").order("sort").order("title"),
      supabase.from("user_quests").select("quest_id, active").eq("user_id", userId),
    ]);
    setQuests((qs as Quest[]) ?? []);
    setActiveIds(
      new Set(
        ((uq as { quest_id: string; active: boolean }[]) ?? [])
          .filter((r) => r.active)
          .map((r) => r.quest_id),
      ),
    );
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(q: Quest) {
    const on = activeIds.has(q.id);
    setActiveIds((prev) => {
      const next = new Set(prev);
      if (on) next.delete(q.id);
      else next.add(q.id);
      return next;
    });
    const { error } = await supabase.rpc("set_quest_active", { p_quest_id: q.id, p_active: !on });
    if (error) {
      setError(error.message);
      setActiveIds((prev) => {
        const next = new Set(prev);
        if (on) next.add(q.id);
        else next.delete(q.id);
        return next;
      });
    }
  }

  async function rateQuest(
    title: string,
    pillar: Pillar,
  ): Promise<{ xp: number; reason: string; icon: string } | "nonsense"> {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? "";
      const r = await fetch("/api/rate-quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, pillar }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data?.nonsense === true) return "nonsense";
        const xp = Number(data?.xp);
        if (Number.isFinite(xp) && xp >= 1 && xp <= 50) {
          return {
            xp: Math.round(xp),
            reason: String(data.reason ?? ""),
            icon: typeof data.icon === "string" ? data.icon : "custom",
          };
        }
      }
    } catch {}
    return { xp: 10, reason: "Standard daily effort.", icon: "custom" };
  }

  async function saveForm() {
    if (!form) return;
    setBusy(true);
    setError(null);
    setVerdict(null);
    const rating = await rateQuest(form.title, form.pillar);
    if (rating === "nonsense") {
      setBusy(false);
      setError(NONSENSE_MSG);
      return;
    }
    const { error } = form.id
      ? await supabase.rpc("update_custom_quest", {
          p_id: form.id,
          p_title: form.title,
          p_pillar: form.pillar,
          p_xp: rating.xp,
          p_icon: rating.icon,
        })
      : await supabase.rpc("create_custom_quest", {
          p_title: form.title,
          p_pillar: form.pillar,
          p_xp: rating.xp,
          p_icon: rating.icon,
        });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setVerdict({ title: form.title, xp: rating.xp, reason: rating.reason });
    setForm(null);
    load();
  }

  async function saveScreenTime() {
    if (!stForm) return;
    setBusy(true);
    setError(null);
    const limit = SCREEN_LIMITS.find((l) => l.minutes === stForm.minutes) ?? SCREEN_LIMITS[1];
    const { error } = await supabase.rpc("create_custom_quest", {
      p_title: `Under ${limit.label} on ${stForm.app.trim()}`,
      p_pillar: "Discipline",
      p_xp: limit.xp,
      p_icon: "phone-off",
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStForm(null);
    load();
  }

  async function remove(q: Quest) {
    setError(null);
    const { error } = await supabase.rpc("delete_custom_quest", { p_id: q.id });
    if (error) setError(error.message);
    else load();
  }

  if (!loaded) {
    return <div className="hud-label pulse-glow text-center py-20">Opening the armory…</div>;
  }

  const customs = quests.filter((q) => q.user_id === uid && uid);
  const catalog = quests.filter((q) => !q.user_id);

  return (
    <div className="slide-in">
      <h1 className="display text-[28px]">Loadout</h1>
      <p className="hud-label mt-1.5">Active quests appear on Today</p>

      {error && <p className="text-danger text-sm mt-3">{error}</p>}

      {/* custom quests */}
      <h2 className="display text-[15px] mt-6 mb-3">Yours · {customs.length}</h2>
      {!form && !stForm && (
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <button
            className="btn-ghost !text-xs py-3 gap-1.5"
            onClick={() => setStForm({ app: "", minutes: 60 })}
          >
            <Icon name="phone-off" size={13} strokeWidth={2} />
            Screen time
          </button>
          <button className="btn-primary !text-xs py-3 gap-1.5" onClick={() => setForm(EMPTY_FORM)}>
            <Icon name="plus" size={13} strokeWidth={2.2} />
            New quest
          </button>
        </div>
      )}

      {stForm && (
        <div className="hud-frame p-4 mb-3 rise">
          <div className="display text-[15px] mb-1">Screen time</div>
          <p className="hud-label mb-3.5">Tighter limit · bigger XP</p>
          <input
            className="field w-full px-4 py-3 text-[15px]"
            placeholder="App name (e.g. TikTok, Instagram)"
            value={stForm.app}
            maxLength={30}
            onChange={(e) => setStForm({ ...stForm, app: e.target.value })}
          />
          <div className="hud-label mt-4 mb-2">Daily limit</div>
          <div className="grid grid-cols-4 gap-2">
            {SCREEN_LIMITS.map((l) => (
              <button
                key={l.minutes}
                className={`option-row px-2 py-2.5 flex flex-col items-center gap-0.5 ${stForm.minutes === l.minutes ? "selected" : ""}`}
                onClick={() => setStForm({ ...stForm, minutes: l.minutes })}
              >
                <span className="text-sm font-semibold">{l.label}</span>
                <span className="hud-label">+{l.xp} XP</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2.5 mt-5">
            <button className="btn-ghost flex-1 py-3" onClick={() => setStForm(null)}>
              Cancel
            </button>
            <button
              className="btn-primary flex-1 py-3"
              disabled={busy || stForm.app.trim().length < 2}
              onClick={saveScreenTime}
            >
              Set the limit
            </button>
          </div>
        </div>
      )}

      {verdict && !form && (
        <div className="hud-frame p-4 mb-3 rise">
          <div className="display text-[15px]" style={{ color: "var(--accent)" }}>Verdict</div>
          <p className="text-sm mt-1.5">
            <span className="font-semibold">{verdict.title}</span> is worth{" "}
            <span className="display text-[16px]" style={{ color: "var(--accent)" }}>+{verdict.xp} XP</span>
          </p>
          {verdict.reason && <p className="text-xs text-muted mt-1.5">{verdict.reason}</p>}
          <button className="hud-label mt-2.5 underline underline-offset-4" onClick={() => setVerdict(null)}>
            Accepted
          </button>
        </div>
      )}

      {form && (
        <div className="hud-frame p-4 mb-3 rise">
          <div className="display text-[15px] mb-3">{form.id ? "Edit quest" : "Forge a quest"}</div>
          <input
            className="field w-full px-4 py-3 text-[15px]"
            placeholder="Quest name (e.g. Stretch 10 minutes)"
            value={form.title}
            maxLength={60}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="hud-label mt-4 mb-2">Category</div>
          <div className="grid grid-cols-5 gap-1.5">
            {PILLARS.map((p) => (
              <button
                key={p}
                className={`option-row px-1 py-2.5 flex flex-col items-center gap-1.5 ${form.pillar === p ? "selected" : ""}`}
                onClick={() => setForm({ ...form, pillar: p })}
              >
                <Icon name={PILLAR_ICONS[p]} size={21} />
                <span className="hud-label !text-ink">{PILLAR_STAT[p]}</span>
              </button>
            ))}
          </div>
          <p className="hud-label mt-4">The judge sets the XP · 1 to 50</p>
          <div className="flex gap-2.5 mt-4">
            <button className="btn-ghost flex-1 py-3" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button
              className="btn-primary flex-1 py-3"
              disabled={busy || form.title.trim().length < 2}
              onClick={saveForm}
            >
              {busy ? "Judging…" : form.id ? "Save & re-judge" : "Forge it"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {customs.map((q) => {
          const on = activeIds.has(q.id);
          return (
            <div key={q.id} className={`option-row px-4 py-3.5 flex items-center gap-3 ${on ? "selected" : ""}`}>
              <button className="icon-tile active:scale-95 transition-transform" onClick={() => toggleActive(q)} aria-label={on ? "Deactivate" : "Activate"}>
                <Icon name={on ? "check" : PILLAR_ICONS[q.pillar]} size={21} strokeWidth={on ? 2.2 : 1.6} className={on ? "text-accent" : undefined} />
              </button>
              <button className="flex-1 text-left min-w-0" onClick={() => toggleActive(q)}>
                <span className={`block text-[15px] truncate ${on ? "" : "text-muted"}`}>{q.title}</span>
                <span className="hud-label mt-0.5">{q.pillar} · +{q.xp} XP {on ? "· active" : ""}</span>
              </button>
              <button
                className="icon-tile !w-9 !h-9 !rounded-[10px] active:scale-95 transition-transform"
                aria-label="Edit"
                onClick={() => setForm({ id: q.id, title: q.title, pillar: q.pillar })}
              >
                <Icon name="pen" size={15} />
              </button>
              <button
                className="icon-tile !w-9 !h-9 !rounded-[10px] active:scale-95 transition-transform text-danger"
                aria-label="Delete"
                onClick={() => remove(q)}
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          );
        })}
        {customs.length === 0 && !form && (
          <div className="card p-5 text-center text-muted text-sm">
            Nothing forged yet. Your own quests live here.
          </div>
        )}
      </div>

      {/* catalog */}
      <h2 className="display text-[15px] mt-7 mb-3">Armory · {catalog.length}</h2>
      <div className="flex flex-col gap-2.5 pb-4">
        {catalog.map((q) => {
          const on = activeIds.has(q.id);
          return (
            <button
              key={q.id}
              className={`option-row px-4 py-3.5 flex items-center gap-3 ${on ? "selected" : ""}`}
              onClick={() => toggleActive(q)}
            >
              <span className="icon-tile" style={on ? { color: "var(--accent)", borderColor: "rgba(255,107,0,0.4)" } : undefined}>
                <Icon name={PILLAR_ICONS[q.pillar]} size={23} />
              </span>
              <span className="flex-1 text-left min-w-0">
                <span className={`block text-[15px] truncate ${on ? "" : "text-muted"}`}>{q.title}</span>
                <span className="hud-label mt-0.5">{q.pillar} · +{q.xp} XP</span>
              </span>
              <span
                className="hud-label flex-none"
                style={{ color: on ? "var(--accent)" : "var(--muted)" }}
              >
                {on ? "Active" : "Add"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
