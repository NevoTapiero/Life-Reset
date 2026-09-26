"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import { PILLARS, PILLAR_ICONS, Pillar, Quest } from "@/lib/game";

const XP_CHOICES = [
  { xp: 10, label: "Light" },
  { xp: 15, label: "Solid" },
  { xp: 20, label: "Hard" },
  { xp: 25, label: "Epic" },
];

type FormState = { id: string | null; title: string; pillar: Pillar; xp: number };
const EMPTY_FORM: FormState = { id: null, title: "", pillar: "Body", xp: 15 };

export default function QuestManager() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [uid, setUid] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
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

  async function saveForm() {
    if (!form) return;
    setBusy(true);
    setError(null);
    const { error } = form.id
      ? await supabase.rpc("update_custom_quest", {
          p_id: form.id,
          p_title: form.title,
          p_pillar: form.pillar,
          p_xp: form.xp,
        })
      : await supabase.rpc("create_custom_quest", {
          p_title: form.title,
          p_pillar: form.pillar,
          p_xp: form.xp,
        });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm(null);
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
      <span className="eyebrow hud-label !text-ink">System · Quest manager</span>
      <h1 className="display text-2xl mt-3">YOUR LOADOUT</h1>
      <p className="text-muted text-sm mt-1.5">
        Active quests appear on Today. Forge your own or draw from the armory.
      </p>

      {error && <p className="text-danger text-sm mt-3">{error}</p>}

      {/* custom quests */}
      <div className="flex items-center justify-between mt-6 mb-3">
        <span className="hud-label">Your quests · {customs.length}</span>
        {!form && (
          <button className="btn-primary !text-xs px-4 py-2 gap-1.5" onClick={() => setForm(EMPTY_FORM)}>
            <Icon name="plus" size={13} strokeWidth={2.2} />
            New quest
          </button>
        )}
      </div>

      {form && (
        <div className="hud-frame p-4 mb-3 rise">
          <div className="hud-label mb-3">{form.id ? "Edit quest" : "Forge a quest"}</div>
          <input
            className="field w-full px-4 py-3 text-[15px]"
            placeholder="Quest name (e.g. Stretch 10 minutes)"
            value={form.title}
            maxLength={60}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <div className="hud-label mt-4 mb-2">Pillar</div>
          <div className="grid grid-cols-3 gap-2">
            {PILLARS.map((p) => (
              <button
                key={p}
                className={`option-row py-2.5 flex flex-col items-center gap-1.5 ${form.pillar === p ? "selected" : ""}`}
                onClick={() => setForm({ ...form, pillar: p })}
              >
                <Icon name={PILLAR_ICONS[p]} size={17} />
                <span className="hud-label !text-ink">{p}</span>
              </button>
            ))}
          </div>
          <div className="hud-label mt-4 mb-2">Difficulty</div>
          <div className="grid grid-cols-4 gap-2">
            {XP_CHOICES.map((c) => (
              <button
                key={c.xp}
                className={`option-row py-2.5 flex flex-col items-center gap-0.5 ${form.xp === c.xp ? "selected" : ""}`}
                onClick={() => setForm({ ...form, xp: c.xp })}
              >
                <span className="text-sm font-semibold">+{c.xp}</span>
                <span className="hud-label">{c.label}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2.5 mt-5">
            <button className="btn-ghost flex-1 py-3" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button
              className="btn-primary flex-1 py-3"
              disabled={busy || form.title.trim().length < 2}
              onClick={saveForm}
            >
              {form.id ? "Save" : "Forge it"}
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
                <Icon name={on ? "check" : q.icon} size={19} strokeWidth={on ? 2.2 : 1.6} className={on ? "text-accent" : undefined} />
              </button>
              <button className="flex-1 text-left min-w-0" onClick={() => toggleActive(q)}>
                <span className={`block text-[15px] truncate ${on ? "" : "text-muted"}`}>{q.title}</span>
                <span className="hud-label mt-0.5">{q.pillar} · +{q.xp} XP {on ? "· active" : ""}</span>
              </button>
              <button
                className="icon-tile !w-9 !h-9 !rounded-[10px] active:scale-95 transition-transform"
                aria-label="Edit"
                onClick={() => setForm({ id: q.id, title: q.title, pillar: q.pillar, xp: q.xp })}
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
      <div className="hud-label mt-7 mb-3">Armory · {catalog.length}</div>
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
                <Icon name={q.icon} size={21} />
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
