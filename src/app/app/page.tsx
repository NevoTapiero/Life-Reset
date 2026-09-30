"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppActivity from "@/components/AppActivity";
import BrickLoader from "@/components/BrickLoader";
import Icon from "@/components/Icon";
import LegoIcon, { PILLAR_BRICK_COLOR } from "@/components/LegoIcon";
import MinifigPicker from "@/components/MinifigPicker";
import FirstTips from "@/components/FirstTips";
import Minifig from "@/components/Minifig";
import RankUp, { BrickBurst } from "@/components/RankUp";
import { brickSound } from "@/lib/brickSound";
import { useMissions } from "@/lib/useMissions";
import { greeting, legoLevel, levelTitle } from "@/lib/brick";
import {
  CARD_DAYS,
  PERIODS,
  PERIOD_LABEL,
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
  // null until the first load, then whether today's daily missions were all done
  const [wasCleared, setWasCleared] = useState<boolean | null>(null);
  const [justCleared, setJustCleared] = useState(false);
  // studs flying from a checked mission into the stud counter
  const counterRef = useRef<HTMLSpanElement>(null);
  const [flying, setFlying] = useState<{ id: number; x: number; y: number; dx: number; dy: number; delay: number }[]>([]);
  const [bump, setBump] = useState(false);
  const flyId = useRef(0);
  function flyStuds(from: DOMRect) {
    const to = counterRef.current?.getBoundingClientRect();
    if (!to) return;
    const tx = to.left + 14;
    const ty = to.top + to.height / 2;
    const base = (flyId.current += 10);
    const studs = Array.from({ length: 7 }, (_, i) => {
      const x = from.right - 40 - (i % 3) * 14;
      const y = from.top + from.height / 2 + ((i * 7) % 11) - 5;
      return { id: base + i, x, y, dx: tx - x, dy: ty - y, delay: i * 55 };
    });
    setFlying((f) => [...f, ...studs]);
    setTimeout(() => setBump(true), 620);
    setTimeout(() => {
      setBump(false);
      setFlying((f) => f.filter((s) => s.id < base || s.id > base + 6));
    }, 1100);
  }
  useEffect(() => {
    if (justCleared) brickSound.levelUp(false);
  }, [justCleared]);

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
  if (m.days && clearedAll !== wasCleared) {
    // cleared just now (not already cleared when the page opened): celebrate
    if (clearedAll && wasCleared === false) setJustCleared(true);
    setWasCleared(clearedAll);
  }
  const yOpen = m.days ? m.yesterdayList.filter((q) => !m.isDoneOn(q, m.days!.yesterday)).length : 0;

  return (
    <div className="slide-in">
      {!p.archetype && <MinifigPicker onPicked={m.setProfile} />}
      {flying.map((f) => (
        <span
          key={f.id}
          className="flying-stud"
          aria-hidden
          style={{ left: f.x, top: f.y, "--dx": `${f.dx}px`, "--dy": `${f.dy}px`, animationDelay: `${f.delay}ms` } as React.CSSProperties}
        />
      ))}
      {m.rankUp && <RankUp rank={m.rankUp.rank} previousTier={m.rankUp.previousTier} character={p.archetype} onClose={m.dismissRankUp} />}

      {/* you, today: a LEGO-game player card */}
      <section className="card tile-studs">
        <div className="flex items-end gap-2 px-4 pt-3">
          <Link href="/app/profile" aria-label="Your profile" className="player-stage flex-none -mb-1">
            <Minifig character={p.archetype} level={legoLevel(rank.tierIndex)} size={104} />
          </Link>
          <div className="flex-1 min-w-0 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="hud-label">{greeting()}</div>
              <span className={`stud-counter ${bump ? "bump" : ""}`} title="Gold studs" ref={counterRef}>
                <span className="stud-spin" aria-hidden />
                {(p.gold ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="display text-[25px] truncate leading-tight mt-0.5">{p.username}</div>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="chip chip-blue">Lv {legoLevel(rank.tierIndex)}</span>
              <span className="text-[14px] font-extrabold">{levelTitle(p.archetype, rank.tierIndex)}</span>
              <span className="chip chip-orange ml-auto" title="Days in a row">
                <Icon name="flame" size={13} strokeWidth={2.4} />
                {p.streak_current}
              </span>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-3 rounded-b-[18px]" style={{ background: "var(--panel-2)" }}>
          <div className="flex items-center justify-between text-[12.5px] font-extrabold">
            <span>{rank.label}</span>
            <span className="text-muted">{next ? `${rank.xpForStage - rank.xpIntoStage} XP to ${next}` : "Top rank"}</span>
          </div>
          <div className="xp-bricks mt-2" role="progressbar" aria-label="XP to the next rank" aria-valuenow={rank.xpIntoStage} aria-valuemax={rank.xpForStage}>
            {Array.from({ length: 10 }, (_, i) => {
              const fill = Math.min(1, Math.max(0, rank.progress * 10 - i));
              return <span key={i} className={fill >= 1 ? "on" : fill > 0 ? "part" : ""} style={{ "--fill": `${Math.round(fill * 100)}%` } as React.CSSProperties} />;
            })}
          </div>
          <div className="mt-1.5 text-[12px] font-extrabold text-muted">{p.xp.toLocaleString()} XP total</div>
        </div>
      </section>

      {p.archetype && <FirstTips />}

      {/* missions */}
      <div className="flex items-center justify-between mt-7 mb-3">
        <h1 className="section-title">Missions</h1>
        <Link href="/app/quests" className="btn-ghost brick-flat !text-[13px] px-3.5 py-2 !rounded-[12px]">
          <Icon name="plus" size={15} strokeWidth={2.4} />
          Add or edit
        </Link>
      </div>

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
              if (!m.isDoneOn(q, m.today) && !trackedBy(q, m.trackers)) flyStuds(from);
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
        <div className="card mt-4 p-4 flex items-center gap-3 rise relative" style={{ background: "var(--lego-yellow)", boxShadow: "0 4px 0 var(--lego-yellow-edge)" }}>
          {justCleared && <BrickBurst count={26} />}
          <span className="bounce-in">
            <LegoIcon name="trophy" color="orange" size={44} />
          </span>
          <span>
            <span className="display block text-[17px]">All missions done</span>
            <span className="text-sm font-bold opacity-75">The streak holds. See you tomorrow.</span>
          </span>
        </div>
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
      <AppActivity onXp={m.load} />
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
            <span className="text-[12px] font-extrabold text-muted">
              {label ? `${label} · ` : ""}+{cardXp(q.xp, cardDay)} XP
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
