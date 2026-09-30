"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import AppActivity from "@/components/AppActivity";
import BrickLoader from "@/components/BrickLoader";
import Icon from "@/components/Icon";
import LegoIcon, { PILLAR_BRICK_COLOR } from "@/components/LegoIcon";
import MinifigPicker from "@/components/MinifigPicker";
import FirstTips from "@/components/FirstTips";
import TellTheJudge from "@/components/TellTheJudge";
import StartSteps from "@/components/StartSteps";
import BuildYourDay from "@/components/BuildYourDay";
import { GoldBrick } from "@/components/GoldBricks";
import { goldBricks, saveSeenGold, seenGold, type GoldBrick as GoldBrickT } from "@/lib/goldBricks";
import Minifig from "@/components/Minifig";
import StudCount from "@/components/StudCount";
import Hearts from "@/components/Hearts";
import { extraOn } from "@/lib/extras";
import RankUp, { BrickBurst } from "@/components/RankUp";
import { brickSound } from "@/lib/brickSound";
import { energyFrom, todayKey, type LedgerMeta } from "@/lib/energy";
import { supabase } from "@/lib/supabase";
import { useMissions } from "@/lib/useMissions";
import { greeting, sleepyHour, legoLevel, levelTitle } from "@/lib/brick";
import {
  CARD_DAYS,
  PERIODS,
  PERIOD_LABEL,
  STREAK_BONUS_XP,
  PERIOD_UNIT,
  PILLAR_ICONS,
  Period,
  Quest,
  TIERS,
  TRACKER_NAME,
  cardXp,
  periodOf,
  rankForXp,
  trackedBy,
} from "@/lib/game";

// Home: who you are today, your missions (daily, weekly, monthly), yesterday's
// grace list, and what your connected apps counted.
export default function HomePage() {
  const m = useMissions();
  const [tab, setTab] = useState<Period>("daily");
  const [showYesterday, setShowYesterday] = useState(false);
  // the evening recap (also opened by the app shortcut /app?build=1)
  const [building, setBuilding] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("build") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads the address once
      setBuilding(true);
      // a reload shouldn't reopen it
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  // null until the first load, then whether today's daily missions were all done
  const [wasCleared, setWasCleared] = useState<boolean | null>(null);
  const [justCleared, setJustCleared] = useState(false);
  // studs flying from a checked mission into the XP bar
  const counterRef = useRef<HTMLDivElement>(null);
  const [flying, setFlying] = useState<{ id: number; x: number; y: number; dx: number; dy: number; delay: number; kind: string }[]>([]);
  const [bump, setBump] = useState(false);
  const flyId = useRef(0);
  // studs are worth more by colour, like the LEGO games: silver, gold, blue
  function flyStuds(from: DOMRect, xp = 0) {
    const kind = xp >= 16 ? "blue" : xp >= 8 ? "" : "silver";
    const to = counterRef.current?.getBoundingClientRect();
    if (!to) return;
    // aim at the XP bar's first empty brick
    const tx = to.left + Math.min(0.95, Math.max(0.05, (m.profile ? rankForXp(m.profile.xp).progress : 0) + 0.05)) * to.width;
    const ty = to.top + to.height / 2;
    // the Stud rain extra sends three times as many
    const count = extraOn("studrain") ? 21 : 7;
    const base = (flyId.current += 30);
    const studs = Array.from({ length: count }, (_, i) => {
      const x = from.right - 40 - (i % 3) * 14 - (i >= 7 ? ((i * 23) % 120) : 0);
      const y = from.top + from.height / 2 + ((i * 7) % 11) - 5;
      return { id: base + i, x, y, dx: tx - x, dy: ty - y, delay: (i % 7) * 55 + Math.floor(i / 7) * 30, kind };
    });
    setFlying((f) => [...f, ...studs]);
    setTimeout(() => setBump(true), 620);
    setTimeout(() => {
      setBump(false);
      setFlying((f) => f.filter((s) => s.id < base || s.id >= base + count));
    }, 1100);
  }
  useEffect(() => {
    if (justCleared) brickSound.levelUp(false);
  }, [justCleared]);
  // a gold brick earned just now: a toast (Profile has the whole collection)
  const [newGold, setNewGold] = useState<GoldBrickT | null>(null);
  const xpNow = m.profile?.xp;
  const uidNow = m.profile?.id;
  useEffect(() => {
    if (!m.profile || !m.days) return;
    const earned = goldBricks(m.profile, { done: m.doneCount }).filter((b) => b.got);
    const seen = seenGold(m.profile.id);
    if (!seen) {
      // first time on this device: remember, don't celebrate the past
      saveSeenGold(m.profile.id, earned.map((b) => b.id));
      return;
    }
    const fresh = earned.filter((b) => !seen.has(b.id));
    if (fresh.length === 0) return;
    saveSeenGold(m.profile.id, [...seen, ...fresh.map((b) => b.id)]);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to a milestone just crossed
    setNewGold(fresh[0]);
    brickSound.stud(7);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-check when XP, streak or checks change
  }, [xpNow, uidNow, m.doneCount, m.profile?.streak_current, m.days]);
  // the toast hides itself (its own timer, so a reload can't cancel it)
  useEffect(() => {
    if (!newGold) return;
    const t = setTimeout(() => setNewGold(null), 4200);
    return () => clearTimeout(t);
  }, [newGold]);

  // energy for running in the town, from last night's sleep and today's steps
  // (the same rule as the town: src/lib/energy.ts)
  const [energy, setEnergy] = useState<number | null>(null);
  // XP your apps paid that waits in your chest at home (collected in the world)
  const [chest, setChest] = useState(0);
  const loadChest = useCallback(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      supabase
        .from("xp_ledger")
        .select("pending_xp")
        .eq("user_id", uid)
        .is("collected_at", null)
        .then(({ data: rows, error }) => {
          if (!error) setChest(((rows ?? []) as { pending_xp: number }[]).reduce((a, r) => a + (r.pending_xp ?? 0), 0));
        });
      const since = new Date(new Date().getTime() - 36 * 3600 * 1000).toISOString();
      supabase
        .from("xp_ledger")
        .select("meta")
        .eq("user_id", uid)
        .gte("created_at", since)
        .then(({ data: rows }) => setEnergy(energyFrom((rows ?? []).map((r) => r.meta as LedgerMeta), todayKey())));
    });
  }, []);
  useEffect(() => {
    loadChest();
  }, [loadChest]);

  if (!m.profile) {
    return (
      <div className="py-24 flex justify-center">
        {m.loadFailed ? (
          <div className="card p-6 text-center max-w-[300px]">
            <p className="display text-[19px]">No connection</p>
            <p className="text-[13.5px] font-bold text-muted mt-1">Your missions are safe. Check your internet and try again.</p>
            <button className="btn-primary brick-yellow px-6 py-3 mt-4" onClick={m.load}>
              Try again
            </button>
          </div>
        ) : (
          <BrickLoader label="Building your day" />
        )}
      </div>
    );
  }

  const p = m.profile;
  const rank = rankForXp(p.xp);
  const next = rank.atMax
    ? null
    : rank.stageIndex < 2
      ? `${rank.tier} ${["I", "II", "III"][rank.stageIndex + 1]}`
      : TIERS[rank.tierIndex + 1]
        ? `${TIERS[rank.tierIndex + 1].name} I`
        : null;
  const tabQuests = m.inPeriod(tab);
  const daily = m.counts.daily;
  const clearedAll = daily.total > 0 && daily.done === daily.total;
  // where today sits in the 7-day streak cycle (1..7; 0 = no streak yet)
  // (the saved streak is the run ending on the last day you checked
  // something: it only still counts if that was today or yesterday)
  const lastDone = p.last_completed_on;
  const doneToday = !!m.days && lastDone === m.days.today;
  const alive = doneToday || (!!m.days && lastDone === m.days.yesterday);
  const streakNow = alive ? p.streak_current : 0;
  const streakDay = streakNow <= 0 ? 0 : doneToday ? ((streakNow - 1) % 7) + 1 : streakNow % 7;
  const evening = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date())) >= 17;
  if (m.days && clearedAll !== wasCleared) {
    // cleared just now (not already cleared when the page opened): celebrate
    if (clearedAll && wasCleared === false) setJustCleared(true);
    if (!clearedAll) setJustCleared(false);
    setWasCleared(clearedAll);
  }
  const xpToday = m
    .inPeriod("daily")
    .filter((q) => !trackedBy(q, m.trackers) && m.isDoneOn(q, m.today))
    .reduce((sum, q) => sum + cardXp(q.xp, m.cardDayOf(q)), 0);
  const yOpen = m.days ? m.yesterdayList.filter((q) => !m.isDoneOn(q, m.days!.yesterday)).length : 0;

  return (
    <div className="slide-in">
      {!p.archetype && <MinifigPicker onPicked={m.setProfile} />}
      {newGold && (
        <button className="gold-toast" onClick={() => setNewGold(null)} aria-live="polite">
          <span className="relative">
            <GoldBrick got size={46} />
            <BrickBurst count={14} />
          </span>
          <span className="text-left">
            <span className="block text-[11px] font-black tracking-wider uppercase opacity-80">Gold brick</span>
            <span className="display tt-text block text-[20px] leading-tight">{newGold.name}</span>
          </span>
        </button>
      )}
      {building && p.archetype && (
        <BuildYourDay
          quests={m.inPeriod("daily").filter((q) => !trackedBy(q, m.trackers))}
          isDone={(q) => m.isDoneOn(q, m.today)}
          pendingId={m.pendingId}
          onCheck={(q, from) => {
            if (m.canToggle(q)) flyStuds(from, cardXp(q.xp, m.cardDayOf(q)));
            m.toggle(q);
          }}
          onClose={() => setBuilding(false)}
        />
      )}
      {flying.map((f) => (
        <span
          key={f.id}
          className={`flying-stud ${f.kind}`}
          aria-hidden
          style={{ left: f.x, top: f.y, "--dx": `${f.dx}px`, "--dy": `${f.dy}px`, animationDelay: `${f.delay}ms` } as React.CSSProperties}
        />
      ))}
      {m.rankUp && <RankUp rank={m.rankUp.rank} previousTier={m.rankUp.previousTier} character={p.archetype} onClose={m.dismissRankUp} />}

      {/* you, today: a LEGO-game player card */}
      <section className="card tile-studs">
        <div className="flex items-end gap-2 px-4 pt-3">
          <Link href="/app/profile" aria-label="Your profile" className="player-stage me-fig flex-none -mb-1">
            <Minifig
              character={p.archetype}
              level={legoLevel(rank.tierIndex)}
              size={104}
              alive
              sleepy={!clearedAll && sleepyHour()}
              className={clearedAll ? "mf-cheer" : undefined}
            />
          </Link>
          <div className="flex-1 min-w-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="hud-label">{greeting()}</div>
              <Link href="/app/town" aria-label={`${(p.gold ?? 0).toLocaleString()} gold studs: spend them in your world`} className="stud-counter" title="Gold studs: spend them in your world">
                <span className="stud-spin" aria-hidden />
                <StudCount value={p.gold ?? 0} storeKey={`sl-studs-seen-${p.id}`} />
              </Link>
            </div>
            <div className="display text-[25px] truncate leading-tight mt-0.5">{p.username}</div>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="chip chip-blue">Lv {legoLevel(rank.tierIndex)}</span>
              <span className="text-[14px] font-extrabold">{levelTitle(p.archetype, rank.tierIndex)}</span>
              <span className="chip chip-orange ml-auto" title="Days in a row">
                <Icon name="flame" size={13} strokeWidth={2.4} />
                {streakNow}
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-3 rounded-b-[18px]" style={{ background: "var(--panel-2)" }}>
          <div className="flex items-center justify-between text-[12.5px] font-extrabold">
            <span>{rank.label}</span>
            <span className="text-muted">{next ? `${rank.xpForStage - rank.xpIntoStage} XP to ${next}` : "Top rank"}</span>
          </div>
          <div ref={counterRef} className={`xp-bricks mt-2 ${bump ? "bump" : ""}`} role="progressbar" aria-label="XP to the next rank" aria-valuenow={rank.xpIntoStage} aria-valuemax={rank.xpForStage}>
            {Array.from({ length: 10 }, (_, i) => {
              const fill = Math.min(1, Math.max(0, rank.progress * 10 - i));
              return <span key={i} className={fill >= 1 ? "on" : fill > 0 ? "part" : ""} style={{ "--fill": `${Math.round(fill * 100)}%` } as React.CSSProperties} />;
            })}
          </div>
          <div className="mt-1.5 text-[12px] font-extrabold text-muted">{p.xp.toLocaleString()} XP total</div>
          {/* the streak week: day 7 pays the bonus */}
          <div className="mt-3 flex items-center gap-2" title={`Every 7th day in a row pays +${STREAK_BONUS_XP} XP`}>
            <span className="text-[12.5px] font-extrabold flex items-center gap-1 w-[62px]">
              <Icon name="flame" size={13} strokeWidth={2.4} />
              Streak
            </span>
            <span className="streak-studs flex-1" aria-label={`Day ${streakDay} of 7 toward the +${STREAK_BONUS_XP} bonus`}>
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className={i < streakDay ? (i === 6 ? "gold" : "on") : i === 6 ? "goal" : ""} />
              ))}
            </span>
            <span className="text-[12px] font-extrabold text-muted w-[88px] text-right">
              {streakDay === 7 && doneToday ? `+${STREAK_BONUS_XP} today!` : `${7 - streakDay} to +${STREAK_BONUS_XP}`}
            </span>
          </div>
          {energy !== null && (
            <div className="mt-3 flex items-center gap-2" title="Energy for running in the world: sleep well and walk to fill it">
              <span className="text-[12.5px] font-extrabold flex items-center gap-1 w-[62px]">
                <Icon name="bolt" size={13} strokeWidth={2.4} />
                Energy
              </span>
              {/* energy as LEGO-game hearts: five, with halves */}
              <span className="flex-1" role="img" aria-label={`Energy ${Math.round(energy)} of 100`}>
                <Hearts value={energy} />
              </span>
              <span className="text-[12px] font-extrabold text-muted w-[88px] text-right">{energy >= 60 ? "Ready to run" : energy >= 30 ? "Sleep, walk" : "Tired"}</span>
            </div>
          )}
        </div>
      </section>

      {chest > 0 && (
        <Link href="/app/town" className="card mt-4 px-4 py-3 flex items-center gap-3 active:translate-y-[2px] transition-transform" style={{ background: "var(--lego-yellow)" }}>
          <span className="chest-wobble flex-none">
            <LegoIcon name="chest" color="orange" size={40} />
          </span>
          <span className="flex-1">
            <span className="display block text-[17px]">Your chest: +{chest.toLocaleString()} XP</span>
            <span className="text-[13px] font-bold opacity-80">Waiting at home. Jump in and open it.</span>
          </span>
          <Icon name="chevron-right" size={18} strokeWidth={2.4} />
        </Link>
      )}

      {p.archetype && <FirstTips />}
      {p.archetype && <StartSteps doneCount={m.doneCount} />}

      {/* missions */}
      <div className="flex items-center justify-between mt-7 mb-3">
        <h1 className="section-title">Missions</h1>
        <Link href="/app/quests" className="btn-ghost brick-flat !text-[13px] px-3.5 py-2 !rounded-[12px]">
          <Icon name="plus" size={15} strokeWidth={2.4} />
          Add or edit
        </Link>
      </div>

      <TellTheJudge
        missions={m.inPeriod(tab).filter((q) => !m.isDoneOn(q, m.today) && !trackedBy(q, m.trackers)).map((q) => ({ id: q.id, title: q.title }))}
        onMatched={async (ids) => {
          const saved: string[] = [];
          for (const id of ids) {
            const q = m.quests.find((x) => x.id === id);
            if (!q || m.isDoneOn(q, m.today) || !m.canToggle(q)) continue;
            const el = document.querySelector(`[data-quest="${CSS.escape(id)}"]`);
            if (el) {
              el.scrollIntoView({ block: "nearest", behavior: "smooth" });
              flyStuds(el.getBoundingClientRect(), cardXp(q.xp, m.cardDayOf(q)));
            }
            if (await m.toggle(q)) saved.push(id);
            await new Promise((r) => setTimeout(r, 450));
          }
          return saved;
        }}
      />

      <div className="brick-tabs grid-cols-3 mb-3.5" role="tablist">
        {PERIODS.map((per) => {
          const c = m.counts[per];
          return (
            <button key={per} role="tab" aria-selected={tab === per} onClick={() => setTab(per)} className={`brick-tab ${tab === per ? "on" : ""}`}>
              {PERIOD_LABEL[per]}
              {c.total > 0 && (
                <span className="count-chip">
                  {c.done}/{c.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* the True Hunter meter, like the LEGO games' True Jedi stud bar:
          it fills as the tab's missions are built, and turns gold when full */}
      {m.counts[tab].total > 0 && (() => {
        const c = m.counts[tab];
        const full = c.done >= c.total;
        return (
          <div
            className={`true-meter ${full ? "full" : ""}`}
            role="progressbar"
            aria-label="True Hunter"
            aria-valuenow={c.done}
            aria-valuemax={c.total}
          >
            <span className="true-meter-bar">
              <span style={{ width: `${Math.round((c.done / c.total) * 100)}%` }} />
            </span>
            <span className="true-meter-medal" aria-hidden />
            <span className="true-meter-label">{full ? "True Hunter!" : `${c.total - c.done} to True Hunter`}</span>
          </div>
        );
      })()}

      {tab !== "daily" && m.today && (
        <p className="text-[13px] font-extrabold text-muted -mt-1.5 mb-3 px-1">{periodLeft(tab, m.today)}</p>
      )}

      {m.error && (
        <p className="card px-4 py-3 mb-3 text-sm font-bold" style={{ color: "var(--danger)" }}>
          {m.error}
        </p>
      )}

      <div className="flex flex-col gap-3 stagger">
        {tabQuests.map((q) => (
          <MissionTile
            key={q.id}
            q={q}
            done={m.isDoneOn(q, m.today)}
            cardDay={m.cardDayOf(q)}
            paidBy={trackedBy(q, m.trackers)}
            pending={m.pendingId === q.id}
            xpFloat={m.xpFloat?.id === q.id ? m.xpFloat.amount : null}
            onToggle={(from) => {
              if (!m.isDoneOn(q, m.today) && m.canToggle(q)) flyStuds(from, cardXp(q.xp, m.cardDayOf(q)));
              m.toggle(q);
            }}
          />
        ))}
        {tabQuests.length === 0 && (
          <div className="card p-6 text-center">
            <div className="flex justify-center gap-1 mb-3" aria-hidden>
              <span className="stack-brick !animate-none" style={{ "--c": "var(--lego-red)" } as React.CSSProperties} />
              <span className="stack-brick !animate-none" style={{ "--c": "var(--lego-yellow)" } as React.CSSProperties} />
            </div>
            <p className="font-bold">
              {tab === "daily" ? "No daily missions yet." : `No ${tab} missions yet.`}
            </p>
            <p className="text-muted text-sm mt-1">
              {tab === "daily"
                ? "Pick a few habits and every one you do builds your world."
                : `Check it once a ${tab === "weekly" ? "week" : "month"}; it pays more.`}
            </p>
            <Link href="/app/quests" className="btn-primary brick-yellow px-5 py-3 mt-4">
              Add a mission
            </Link>
          </div>
        )}
      </div>

      {clearedAll && tab === "daily" && (
        // the LEGO games' results screen: a big outlined title, then the
        // day's numbers sliding in one by one
        <section className="day-complete mt-4 rise relative" aria-label="Day complete">
          {justCleared && <BrickBurst count={26} />}
          <div className="flex items-center justify-between">
            <h2 className="display tt-text text-[26px] leading-none">Day complete!</h2>
            <span className="bounce-in">
              <LegoIcon name="trophy" color="yellow" size={42} />
            </span>
          </div>
          <ul className="day-complete-rows">
            <li style={{ animationDelay: "0.15s" }}>
              <LegoIcon name="check" color="green" size={30} />
              <span>Missions</span>
              <b>
                {daily.done}/{daily.total}
              </b>
            </li>
            <li style={{ animationDelay: "0.3s" }}>
              <span className="day-complete-stud" aria-hidden />
              <span>XP built today</span>
              <b>+{xpToday}</b>
            </li>
            <li style={{ animationDelay: "0.45s" }}>
              <LegoIcon name="star" color="yellow" size={30} />
              <span>True Hunter</span>
              <b className="text-[var(--lego-yellow)]">Yes!</b>
            </li>
            <li style={{ animationDelay: "0.6s" }}>
              <LegoIcon name="flame" color="orange" size={30} />
              <span>Streak</span>
              <b>
                {streakNow} {streakNow === 1 ? "day" : "days"}
              </b>
            </li>
          </ul>
          <p className="text-[13px] font-bold text-white/80 mt-3">The streak holds. See you tomorrow.</p>
        </section>
      )}

      {evening && daily.total > daily.done && tab === "daily" && (
        <button className="card w-full mt-4 px-4 py-3.5 flex items-center gap-3 text-left active:translate-y-[2px] transition-transform" onClick={() => setBuilding(true)}>
          <LegoIcon name="home" color="orange" size={42} />
          <span className="flex-1">
            <span className="display block text-[17px]">Build your day</span>
            <span className="text-[13px] font-bold text-muted">{daily.total - daily.done} still open. A quick evening check.</span>
          </span>
          <Icon name="chevron-right" size={18} strokeWidth={2.4} className="text-muted" />
        </button>
      )}

      {/* yesterday: one day of grace to log what you forgot */}
      {m.yesterdayList.length > 0 && m.days && (
        <div className="mt-5">
          <button className="card w-full px-4 py-3.5 flex items-center gap-3 active:translate-y-[2px] transition-transform" onClick={() => setShowYesterday(!showYesterday)} aria-expanded={showYesterday}>
            <LegoIcon name="calendar" color="white" size={38} />
            <span className="flex-1 text-left">
              <span className="display block text-[16px]">Yesterday</span>
              <span className="text-[13px] font-bold text-muted">{yOpen === 0 ? "All done" : `${yOpen} not checked, you can still log them`}</span>
            </span>
            <span className="text-muted transition-transform duration-300" style={{ transform: showYesterday ? "rotate(180deg)" : "none" }}>
              <Icon name="chevron-down" size={18} strokeWidth={2.2} />
            </span>
          </button>
          {showYesterday && (
            <div className="flex flex-col gap-2.5 mt-2.5 stagger">
              {m.yesterdayList.map((q) => (
                <MissionTile
                  key={q.id}
                  q={q}
                  small
                  done={m.isDoneOn(q, m.days!.yesterday)}
                  cardDay={m.cardDayOf(q, m.days!.yesterday)}
                  label={periodOf(q) === "daily" ? "Yesterday" : `Last ${periodOf(q) === "weekly" ? "week" : "month"}`}
                  pending={m.pendingId === q.id}
                  xpFloat={m.xpFloat?.id === q.id ? m.xpFloat.amount : null}
                  onToggle={() => m.toggle(q, "yesterday")}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* what the connected apps counted */}
      <AppActivity
        onXp={() => {
          m.load();
          loadChest();
        }}
        onSynced={loadChest}
      />
    </div>
  );
}

// Seven studs: the quest's 7-day card. Green = banked, ringed = the one this
// check counts as, the last (yellow) pays x2.5.
function CardStuds({ day, done, unit }: { day: number; done: boolean; unit: string }) {
  return (
    <span className="flex items-center gap-[4px]" aria-label={`${unit} ${day} of ${CARD_DAYS}`}>
      {Array.from({ length: CARD_DAYS }, (_, i) => {
        const n = i + 1;
        const filled = n < day || (n === day && done);
        const current = n === day && !done;
        const last = n === CARD_DAYS;
        const size = last ? 11 : 9;
        return (
          <span
            key={n}
            className="rounded-full"
            style={{
              width: size,
              height: size,
              background: filled ? (last ? "var(--lego-yellow)" : "var(--lego-green)") : "var(--panel-2)",
              boxShadow: filled
                ? `inset 0 -1.5px 0 ${last ? "var(--lego-yellow-edge)" : "var(--lego-green-edge)"}`
                : current
                  ? "0 0 0 2px var(--lego-green)"
                  : "inset 0 -1.5px 0 var(--line-strong)",
            }}
          />
        );
      })}
    </span>
  );
}

function MissionTile({
  q,
  done,
  cardDay,
  paidBy,
  pending,
  xpFloat,
  onToggle,
  small,
  label,
}: {
  q: Quest;
  done: boolean;
  cardDay: number;
  paidBy?: string | null;
  pending: boolean;
  xpFloat: number | null;
  onToggle: (from: DOMRect) => void;
  small?: boolean;
  label?: string;
}) {
  const period = periodOf(q);
  return (
    <button
      onClick={(e) => onToggle(e.currentTarget.getBoundingClientRect())}
      disabled={pending}
      aria-pressed={done}
      data-quest={q.id}
      className={`card relative w-full text-left flex items-center gap-3 ${small ? "px-3 py-2.5" : "px-3 py-3"} transition-transform duration-100 active:translate-y-[2px]`}
      style={{ opacity: paidBy ? 0.8 : 1 }}
    >
      <span className={done && xpFloat !== null ? "brick-snap" : undefined}>
        <LegoIcon name={PILLAR_ICONS[q.pillar as keyof typeof PILLAR_ICONS] ?? "sparkle"} color={PILLAR_BRICK_COLOR[q.pillar] ?? "blue"} size={small ? 38 : 44} />
      </span>
      <span className="flex-1 min-w-0">
        <span className={`block font-extrabold ${small ? "text-[15px]" : "text-[16px]"} truncate ${done ? "line-through text-muted" : ""}`}>{q.title}</span>
        {paidBy ? (
          <span className="mt-1 inline-flex chip !text-[11px] !py-0">Paid by {TRACKER_NAME[paidBy as keyof typeof TRACKER_NAME]}</span>
        ) : (
          <span className="mt-1 flex items-center gap-2 flex-wrap">
            <CardStuds day={cardDay} done={done} unit={PERIOD_UNIT[period]} />
            {label && <span className="text-[12px] font-extrabold text-muted">{label}</span>}
            {/* the reward as a stud pickup: silver, gold or blue by what it pays */}
            <span className="xp-stud" data-kind={cardXp(q.xp, cardDay) >= 16 ? "blue" : cardXp(q.xp, cardDay) >= 8 ? "gold" : "silver"}>
              <i aria-hidden />+{cardXp(q.xp, cardDay)} XP
            </span>
          </span>
        )}
      </span>
      {paidBy ? (
        <LegoIcon name="sparkle" color="azure" size={36} studs={1} />
      ) : (
        <span key={done ? "done" : "todo"} className={`stud-check ${done ? "on check-pop" : ""}`} aria-hidden>
          <Icon name="check" size={18} strokeWidth={3} />
        </span>
      )}
      {xpFloat !== null && <span className="xp-float absolute right-4 -top-2 text-[15px]">+{xpFloat} XP</span>}
    </button>
  );
}

// "3 days left this week (ends Saturday)" / "12 days left this month"
function periodLeft(period: Period, today: string): string {
  const d = new Date(today + "T00:00:00Z");
  if (period === "weekly") {
    const left = 6 - d.getUTCDay(); // weeks run Sunday to Saturday
    return left === 0 ? "Last day of the week: check your weekly missions today." : `${left + 1} days left this week (ends Saturday).`;
  }
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const left = last - d.getUTCDate();
  return left === 0 ? "Last day of the month: check your monthly missions today." : `${left + 1} days left this month.`;
}
