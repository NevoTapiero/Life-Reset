"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import BrickLoader from "@/components/BrickLoader";
import Icon from "@/components/Icon";
import LegoIcon, { PILLAR_BRICK_COLOR } from "@/components/LegoIcon";
import {
  PERIODS,
  PERIOD_LABEL,
  PERIOD_UNIT,
  PERIOD_XP_CAP,
  PILLARS,
  PILLAR_ICONS,
  PILLAR_STAT,
  Period,
  Pillar,
  Quest,
  TRACKER_NAME,
  TrackedKind,
  cardXp,
  periodOf,
  questBase,
  trackedBy,
} from "@/lib/game";

type FormState = { id: string | null; title: string; pillar: Pillar; period: Period };
const EMPTY_FORM: FormState = { id: null, title: "", pillar: "Strength", period: "daily" };
type Rating = { xp: number; reason: string; icon: string; tracks: TrackedKind | null };
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
  const [verdict, setVerdict] = useState<{ title: string; xp: number; reason: string; period: Period } | null>(null);
  // connected apps that measure things on their own (steps, sleep, workouts)
  const [trackers, setTrackers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    setUid(userId);
    if (!userId) return;
    const [{ data: qs }, { data: uq }, { data: tr }] = await Promise.all([
      supabase.from("quests").select("*").eq("archived", false).order("sort").order("title"),
      supabase.from("user_quests").select("quest_id, active").eq("user_id", userId),
      supabase.rpc("my_trackers"),
    ]);
    setQuests((qs as Quest[]) ?? []);
    setTrackers((tr as string[]) ?? []);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server, then sets state
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
    period: Period,
  ): Promise<Rating | "nonsense" | { tracked: string }> {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? "";
      const r = await fetch("/api/rate-quest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, pillar, period }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data?.nonsense === true) return "nonsense";
        if (typeof data?.tracked === "string") return { tracked: data.tracked };
        const xp = Number(data?.xp);
        if (Number.isFinite(xp) && xp >= 1 && xp <= PERIOD_XP_CAP[period]) {
          return {
            xp: Math.round(xp),
            reason: String(data.reason ?? ""),
            icon: typeof data.icon === "string" ? data.icon : "custom",
            tracks: ["steps", "sleep", "workout"].includes(data.tracks) ? (data.tracks as TrackedKind) : null,
          };
        }
      }
    } catch {}
    return { xp: 10, reason: "Standard effort.", icon: "custom", tracks: null };
  }

  async function saveForm() {
    if (!form) return;
    setBusy(true);
    setError(null);
    setVerdict(null);
    const rating = await rateQuest(form.title, form.pillar, form.period);
    if (rating === "nonsense") {
      setBusy(false);
      setError(NONSENSE_MSG);
      return;
    }
    if ("tracked" in rating) {
      // the same activity would pay twice: once from the watch, once from here
      setBusy(false);
      setError(`${rating.tracked} already tracks this and pays for it automatically. No quest needed.`);
      return;
    }
    const { error } = form.id
      ? await supabase.rpc("update_custom_quest", {
          p_id: form.id,
          p_title: form.title,
          p_pillar: form.pillar,
          p_xp: rating.xp,
          p_icon: rating.icon,
          p_tracks: rating.tracks,
        })
      : await supabase.rpc("create_custom_quest", {
          p_title: form.title,
          p_pillar: form.pillar,
          p_xp: rating.xp,
          p_icon: rating.icon,
          p_period: form.period,
          p_tracks: rating.tracks,
        });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setVerdict({ title: form.title, xp: rating.xp, reason: rating.reason, period: form.period });
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
    return (
      <div className="py-24 flex justify-center">
        <BrickLoader label="Opening your missions" />
      </div>
    );
  }

  const customs = quests.filter((q) => q.user_id === uid && uid);
  const catalog = quests.filter((q) => !q.user_id);

  return (
    <div className="slide-in">
      <div className="flex items-center gap-3">
        <Link href="/app" className="icon-tile !w-10 !h-10 !bg-white" aria-label="Back to Home">
          <Icon name="chevron-left" size={20} strokeWidth={2.4} />
        </Link>
        <div>
          <h1 className="display text-[26px]">Your missions</h1>
          <p className="text-[13px] font-bold text-muted">Tap one to put it on Home, tap again to take it off.</p>
        </div>
      </div>

      {error && <p className="card px-4 py-3 mt-4 text-sm font-bold" style={{ color: "var(--danger)" }}>{error}</p>}

      {/* custom quests */}
      <h2 className="section-title mt-7 mb-3" style={{ "--brick": "var(--lego-blue)" } as React.CSSProperties}>
        Made by you <span className="chip !text-[12px]">{customs.length}</span>
      </h2>
      {!form && !stForm && (
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <button
            className="btn-ghost !text-[14px] py-3 gap-1.5"
            onClick={() => setStForm({ app: "", minutes: 60 })}
          >
            <Icon name="phone-off" size={16} strokeWidth={2.2} />
            Screen time
          </button>
          <button className="btn-primary brick-yellow !text-[14px] py-3 gap-1.5" onClick={() => setForm(EMPTY_FORM)}>
            <Icon name="plus" size={16} strokeWidth={2.6} />
            New mission
          </button>
        </div>
      )}

      {stForm && (
        <div className="hud-frame p-4 mb-3 rise">
          <div className="display text-[19px]">Screen time</div>
          <p className="text-[13px] font-bold text-muted mb-3.5">The tighter the limit, the bigger the XP.</p>
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
                <span className="hud-label">+{questBase(l.xp)} XP</span>
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
          <div className="display text-[18px]" style={{ color: "var(--lego-blue)" }}>The AI Judge says</div>
          <p className="text-sm mt-1.5">
            <span className="font-semibold">{verdict.title}</span> is worth{" "}
            <span className="chip chip-green">+{questBase(verdict.xp)} XP</span>
          </p>
          <p className="text-xs text-muted mt-1">
            Pays more each {PERIOD_UNIT[verdict.period].toLowerCase()} in a row, up to +{cardXp(verdict.xp, 7)} XP on{" "}
            {PERIOD_UNIT[verdict.period].toLowerCase()} 7.
          </p>
          {verdict.reason && <p className="text-xs text-muted mt-1.5">{verdict.reason}</p>}
          <button className="btn-ghost brick-flat px-4 py-2 mt-3 !text-[13px]" onClick={() => setVerdict(null)}>
            Got it
          </button>
        </div>
      )}

      {form && (
        <div className="hud-frame p-4 mb-3 rise">
          <div className="display text-[19px] mb-3">{form.id ? "Edit mission" : "New mission"}</div>
          <input
            className="field w-full px-4 py-3 text-[15px]"
            placeholder="What will you do? (e.g. Stretch 10 minutes)"
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
                <LegoIcon name={PILLAR_ICONS[p]} color={form.pillar === p ? PILLAR_BRICK_COLOR[p] : "grey"} size={34} />
                <span className="hud-label !text-ink">{PILLAR_STAT[p]}</span>
              </button>
            ))}
          </div>
          <div className="hud-label mt-4 mb-2">How often</div>
          {form.id ? (
            // changing the period would re-price its whole history
            <p className="text-sm text-muted">{PERIOD_LABEL[form.period]}</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  className={`option-row px-1 py-2.5 flex flex-col items-center gap-0.5 ${form.period === p ? "selected" : ""}`}
                  onClick={() => setForm({ ...form, period: p })}
                >
                  <span className="text-sm font-semibold">{PERIOD_LABEL[p]}</span>
                  <span className="hud-label !text-[9px]">
                    {p === "daily" ? "every day" : p === "weekly" ? "once a week" : "once a month"}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="text-[13px] font-bold text-muted mt-4">The AI Judge sets the XP, the same way for everyone and for the same thing a watch counts.</p>
          <div className="flex gap-2.5 mt-4">
            <button className="btn-ghost flex-1 py-3" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button
              className="btn-primary flex-1 py-3"
              disabled={busy || form.title.trim().length < 2}
              onClick={saveForm}
            >
              {busy ? "Judging..." : form.id ? "Save and re-judge" : "Add it"}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {customs.map((q) => {
          const on = activeIds.has(q.id);
          return (
            <div key={q.id} className={`option-row px-4 py-3.5 flex items-center gap-3 ${on ? "selected" : ""}`}>
              <button className="active:scale-95 transition-transform flex-none" onClick={() => toggleActive(q)} aria-label={on ? "Deactivate" : "Activate"}>
                <LegoIcon name={on ? "check" : PILLAR_ICONS[q.pillar]} color={on ? "green" : "grey"} size={42} />
              </button>
              <button className="flex-1 text-left min-w-0" onClick={() => toggleActive(q)}>
                <span className={`block text-[15px] font-extrabold truncate ${on ? "" : "text-muted"}`}>{q.title}</span>
                <span className="text-[12.5px] font-bold text-muted">
                  {periodOf(q) !== "daily" ? `${PERIOD_LABEL[periodOf(q)]} · ` : ""}
                  {q.pillar} · +{questBase(q.xp)} XP {on ? "· on Home" : ""}
                </span>
                {trackedBy(q, trackers) && (
                  <span className="chip !text-[11px] !py-0 mt-1">
                    Paid by {TRACKER_NAME[trackedBy(q, trackers)!]}
                  </span>
                )}
              </button>
              <button
                className="icon-tile !w-9 !h-9 !rounded-[10px] active:scale-95 transition-transform"
                aria-label="Edit"
                onClick={() => setForm({ id: q.id, title: q.title, pillar: q.pillar, period: periodOf(q) })}
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
          <div className="card p-5 text-center text-[14px] font-bold text-muted">
            Missions you make yourself show up here. The AI Judge prices each one fairly.
          </div>
        )}
      </div>

      {/* catalog */}
      <h2 className="section-title mt-8 mb-3" style={{ "--brick": "var(--lego-green)" } as React.CSSProperties}>
        Ideas to add <span className="chip !text-[12px]">{catalog.length}</span>
      </h2>
      <div className="flex flex-col gap-2.5 pb-4">
        {catalog.map((q) => {
          const on = activeIds.has(q.id);
          return (
            <button
              key={q.id}
              className={`option-row px-4 py-3.5 flex items-center gap-3 ${on ? "selected" : ""}`}
              onClick={() => toggleActive(q)}
            >
              <LegoIcon name={PILLAR_ICONS[q.pillar]} color={on ? PILLAR_BRICK_COLOR[q.pillar] : "grey"} size={42} />
              <span className="flex-1 text-left min-w-0">
                <span className={`block text-[15px] font-extrabold truncate ${on ? "" : "text-muted"}`}>{q.title}</span>
                <span className="text-[12.5px] font-bold text-muted">{q.pillar} · +{questBase(q.xp)} XP</span>
                {trackedBy(q, trackers) && (
                  <span className="chip !text-[11px] !py-0 mt-1">
                    Paid by {TRACKER_NAME[trackedBy(q, trackers)!]}
                  </span>
                )}
              </span>
              <span className={`chip flex-none ${on ? "chip-green" : ""}`}>
                {on ? <Icon name="check" size={13} strokeWidth={3} /> : <Icon name="plus" size={13} strokeWidth={3} />}
                {on ? "On Home" : "Add"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
