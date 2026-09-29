"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import RankBadge from "@/components/RankBadge";
import Room from "@/components/Room";
import XpMeter from "@/components/XpMeter";
import { CHARACTERS, CHARACTER_KEYS, CharacterKey, Profile, Quest, characterOf, nextStreakMilestone, rankForXp } from "@/lib/game";
import { NEED_LABEL, actionFor, appHour, computeNeeds, idleFor, type Spot, type StatKeyNeed } from "@/lib/needs";
import { clearSession, elapsedMin, loadSession, nowMs, startSession, type Session } from "@/lib/session";
import { loadPending, markCollected, sourceInfo, type Pending } from "@/lib/collect";
import { useQuestDay } from "@/lib/useQuestDay";

export default function Dashboard() {
  const [pending, setPending] = useState<Pending[]>([]); // earned while away, not yet tapped
  const { profile, setProfile, quests, doneToday, doneYesterday, rankUp, setRankUp, error, setError, toggle } = useQuestDay((uid) => {
    loadPending(uid).then(setPending);
  });
  const [acting, setActing] = useState<Quest | null>(null); // the quest he is doing in the room right now
  const [collected, setCollected] = useState<{ stat: StatKeyNeed; xp: number }[]>([]); // tapped this visit, feeds the needs
  const [boost, setBoost] = useState<{ id: number; text: string } | null>(null);
  const boostSeq = useRef(0); // each float gets a fresh id so the house replays it
  const [chooser, setChooser] = useState<{ spot: Spot; quests: Quest[] } | null>(null); // the quests that live at a tapped spot
  const [session, setSession] = useState<Session | null>(null); // "doing it now": he does it on screen while you do it
  const [tick, setTick] = useState(0); // re-render the elapsed time every half minute


  const hour = appHour();
  const needs = useMemo(() => computeNeeds(quests, doneToday, doneYesterday, hour, collected), [quests, doneToday, doneYesterday, hour, collected]);

  useEffect(() => {
    // pick up a session left running (state lands in a callback, not in the effect body)
    Promise.resolve().then(() => setSession(loadSession(nowMs())));
    const t = setInterval(() => setTick(nowMs()), 30_000);
    return () => clearInterval(t);
  }, []);

  const sessionQuest = session ? quests.find((q) => q.id === session.questId) ?? null : null;
  const sessionMin = session ? elapsedMin(session, tick || nowMs()) : 0;

  // Logging from the house: he acts it out, and the payout drops as loot to tap.
  function logQuest(q: Quest) {
    toggle(q, "today", {
      onLogged: (quest) => {
        setActing(quest);
        setTimeout(() => setActing(null), 2600);
      },
      onUnlogged: (quest) => setPending((prev) => prev.filter((p) => p.id !== `quest:${quest.id}`)),
      onPaid: (quest) =>
        setPending((prev) => [
          ...prev,
          {
            id: `quest:${quest.id}`,
            source: "quest",
            ref: quest.id,
            xp: quest.xp,
            gold: quest.xp * 2,
            reason: quest.title,
            created_at: new Date().toISOString(),
            stat: quest.stats[0],
            icon: quest.icon,
            label: NEED_LABEL[quest.stats[0]] ?? quest.title,
          },
        ]),
    });
  }

  function beginSession(q: Quest) {
    setSession(startSession(q.id, nowMs()));
    setChooser(null);
  }
  function endSession(log: boolean) {
    clearSession();
    setSession(null);
    if (log && sessionQuest && !doneToday.has(sessionQuest.id)) logQuest(sessionQuest);
  }

  // Tap a bubble: it leaves the tray, the need it feeds jumps, the house floats
  // the amount, and the XP meter finally shows what was already banked.
  function collect(p: Pending) {
    const info = sourceInfo(p);
    setPending((prev) => {
      const rest = prev.filter((x) => x.id !== p.id);
      // ponytail: only remember "collected up to" once the tray is empty, so
      // leaving midway shows the same bubbles again rather than losing some
      if (rest.length === 0) markCollected(prev.reduce((m, x) => (x.created_at > m ? x.created_at : m), p.created_at));
      return rest;
    });
    setCollected((prev) => [...prev, { stat: info.stat, xp: p.xp }]);
    setBoost({ id: ++boostSeq.current, text: `${p.xp > 0 ? "+" : ""}${p.xp} ${info.label}${p.gold ? ` · +${p.gold} gold` : ""}` });
  }

  // Where in the house each undone quest lives; those spots get the marker.
  const available = useMemo(() => {
    const spots = new Set<Spot>();
    for (const q of quests) if (!doneToday.has(q.id)) spots.add(actionFor(q).spot);
    return [...spots];
  }, [quests, doneToday]);

  // Tap the bed, the desk, the mat: log the quest that happens there. One
  // candidate logs straight away; several open a small picker.
  function tapSpot(spot: Spot) {
    if (sessionQuest && actionFor(sessionQuest).spot === spot) return endSession(true); // tapping where he is working finishes it
    const here = quests.filter((q) => !doneToday.has(q.id) && actionFor(q).spot === spot);
    if (here.length) setChooser({ spot, quests: here });
    else setBoost({ id: ++boostSeq.current, text: "Nothing left here" });
  }

  function collectAll() {
    pending.forEach((p, i) => setTimeout(() => collect(p), i * 140)); // a cascade, not a dump
  }

  async function chooseCharacter(key: CharacterKey) {
    const { data, error } = await supabase.rpc("set_archetype", { p_key: key });
    if (error) setError(error.message);
    else setProfile(data as Profile);
  }

  if (!profile) {
    return <div className="hud-label pulse-glow text-center py-20">Syncing quests…</div>;
  }

  // XP that is still floating in the tray stays hidden from the meter until tapped
  const shownXp = Math.max(0, profile.xp - pending.reduce((a, p) => a + p.xp, 0));
  const shownGold = Math.max(0, (profile.gold ?? 0) - pending.reduce((a, p) => a + (p.gold ?? 0), 0));
  const rank = rankForXp(shownXp);
  const character = characterOf(profile.archetype);
  const clearedAll = quests.length > 0 && quests.every((q) => doneToday.has(q.id));
  const milestone = nextStreakMilestone(profile.streak_current);
  const streakPct = Math.min(profile.streak_current / milestone, 1);

  return (
    <div className="slide-in">
      {rankUp && (
        <div className="rankup-backdrop" onClick={() => setRankUp(null)}>
          <div className="relative flex items-center justify-center">
            <div className="rankup-ring" />
            <div className="rankup-ring late" />
            <div className="rankup-badge">
              <RankBadge tierIndex={rankUp.tierIndex} stageIndex={rankUp.stageIndex} size={120} />
            </div>
          </div>
          <div className="rankup-title text-center mt-6">
            <div className="hud-label" style={{ color: "var(--accent)" }}>Rank up</div>
            <div className="display text-3xl mt-1" style={{ color: rankUp.color }}>
              {rankUp.label.toUpperCase()}
            </div>
          </div>
        </div>
      )}
      {/* the room: your character living your day */}
      <Room
        character={profile.archetype}
        needs={needs}
        action={
          acting
            ? actionFor(acting)
            : sessionQuest
              ? { ...actionFor(sessionQuest), label: `${actionFor(sessionQuest).label} · ${sessionMin} min` }
              : idleFor(needs, hour)
        }
        busy={!!acting || !!sessionQuest}
        boost={boost}
        pending={pending}
        onCollect={collect}
        onCollectAll={collectAll}
        available={available}
        onTapSpot={tapSpot}
      />

      {error && <p className="text-danger text-sm mt-3">{error}</p>}

      {sessionQuest && (
        <div className="card p-3 mt-3 flex items-center gap-3 rise">
          <span className="icon-tile !w-9 !h-9 !rounded-[10px] pulse-glow" style={{ color: "var(--accent)" }}>
            <Icon name={sessionQuest.icon} size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="display text-[14px] truncate">{sessionQuest.title}</div>
            <div className="hud-label mt-0.5">{sessionMin} min · he is on it while you are</div>
          </div>
          <button className="btn-primary px-4 py-2.5 !text-xs" onClick={() => endSession(true)}>
            Done
          </button>
          <button className="hud-label px-2 py-2" onClick={() => endSession(false)} aria-label="Stop without logging">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}

      {chooser && (
        <div className="rankup-backdrop" onClick={() => setChooser(null)}>
          <div className="card p-4 w-[88%] max-w-sm rise" onClick={(e) => e.stopPropagation()}>
            <div className="hud-label mb-3">{sessionQuest ? "He is busy -- finish that first" : "What are you doing here?"}</div>
            <div className="flex flex-col gap-2">
              {chooser.quests.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-line"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <span className="icon-tile !w-9 !h-9 !rounded-[10px]"><Icon name={q.icon} size={18} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block display text-[14px] truncate">{q.title}</span>
                    <span className="hud-label" style={{ color: "var(--accent)" }}>+{q.xp} XP · +{q.xp * 2} gold</span>
                  </span>
                  <button
                    className="btn-ghost px-3 py-2 !text-xs"
                    disabled={!!sessionQuest}
                    onClick={() => beginSession(q)}
                  >
                    Start
                  </button>
                  <button
                    className="btn-primary px-3 py-2 !text-xs"
                    onClick={() => {
                      setChooser(null);
                      logQuest(q);
                    }}
                  >
                    Did it
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* hero: hunter card */}
      <div className="bezel mt-4">
        <div className="bezel-core p-4">
          <div className="flex items-center gap-3">
            <Avatar size={64} character={profile.archetype} />
            <div className="flex-1 min-w-0">
              <div className="display text-[17px] leading-tight truncate">{profile.username}</div>
              <div className="mt-1.5">
                <span className="class-pill" style={{ color: character ? character.accent : "var(--accent)" }}>
                  {character ? character.name.replace("The ", "") : "Pick one"}
                </span>
                <span className="class-pill ml-2" style={{ color: "var(--gold)" }}>
                  {shownGold.toLocaleString()} gold
                </span>
              </div>
            </div>
            <Link href="/app/missions" className="flex flex-col items-center flex-none active:scale-95 transition-transform" aria-label="Missions">
              <RankBadge tierIndex={rank.tierIndex} stageIndex={rank.stageIndex} size={50} />
              <span className="hud-label mt-1 whitespace-nowrap" style={{ color: rank.color }}>
                {rank.label}
              </span>
            </Link>
          </div>

          <div className="mt-4">
            <XpMeter rank={rank} xp={shownXp} />

            <div className="mt-4">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="hud-label">Streak · days</span>
                <span className="whitespace-nowrap leading-none">
                  <span className="display text-[16px]" style={{ color: "var(--accent)" }}>
                    {profile.streak_current}
                  </span>
                  <span className="hud-label !text-[10px]">/{milestone}</span>
                </span>
              </div>
              {milestone <= 50 ? (
                // one tick per day toward the next milestone
                <div className="flex gap-[3px] h-[11px]">
                  {Array.from({ length: milestone }).map((_, i) => {
                    const on = i < Math.min(profile.streak_current, milestone);
                    return (
                      <span
                        key={i}
                        className="flex-1 rounded-[2.5px]"
                        style={
                          on
                            ? { background: "linear-gradient(180deg, var(--accent-2), var(--accent))", boxShadow: "0 0 8px rgb(var(--accent-rgb) / 0.5)" }
                            : { background: "#232327" }
                        }
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="bar-seg !h-[11px]">
                  <i style={{ width: `${streakPct * 100}%`, background: "linear-gradient(90deg, var(--bronze), var(--accent))" }} />
                  <b />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* first run: choose your character */}
      {!profile.archetype && (
        <div className="hud-frame p-4 mt-5 rise">
          <div className="display text-[15px] mb-3.5" style={{ color: "var(--accent)" }}>Choose your character</div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {CHARACTER_KEYS.map((key) => (
              <button
                key={key}
                className="flex flex-col items-center gap-1.5 flex-none active:scale-95 transition-transform"
                onClick={() => chooseCharacter(key)}
              >
                <Avatar size={64} character={key} />
                <span className="hud-label !text-ink">{CHARACTERS[key].name.replace("The ", "")}</span>
                <span className="hud-label !text-[9px]">{CHARACTERS[key].stat}</span>
              </button>
            ))}
          </div>
        </div>
      )}


      {clearedAll && (
        <div className="hud-frame p-5 mt-6 text-center rise">
          <div className="flex justify-center bounce-in" style={{ color: "var(--accent)" }}>
            <Icon name="trophy" size={26} strokeWidth={1.8} />
          </div>
          <p className="display mt-2 text-[17px]">All quests cleared</p>
          <p className="hud-label mt-1.5">The streak holds · see you tomorrow</p>
        </div>
      )}
    </div>
  );
}
