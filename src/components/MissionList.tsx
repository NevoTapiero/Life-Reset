"use client";

import { useState } from "react";
import Link from "next/link";
import AppActivity from "@/components/AppActivity";
import Icon from "@/components/Icon";
import { PILLAR_ICONS, Quest, questArt } from "@/lib/game";

// The quest log, shown as a side panel over the world. The world owns the
// day's state and the toggle; this only draws it and adds the +XP float.

export default function MissionList({
  quests,
  doneToday,
  doneYesterday,
  yesterdayQuests,
  pendingId,
  error,
  toggle,
  onXp,
}: {
  quests: Quest[];
  doneToday: Set<string>;
  doneYesterday: Set<string>;
  yesterdayQuests: Quest[];
  pendingId: string | null;
  error: string | null;
  toggle: (q: Quest, day: "today" | "yesterday") => void;
  onXp: () => void;
}) {
  const [showYesterday, setShowYesterday] = useState(false);
  const [xpFloat, setXpFloat] = useState<{ id: string; amount: number } | null>(null);
  const clearedCount = quests.filter((q) => doneToday.has(q.id)).length;

  function log(q: Quest, day: "today" | "yesterday") {
    const done = (day === "today" ? doneToday : doneYesterday).has(q.id);
    if (!done) {
      setXpFloat({ id: q.id, amount: q.xp });
      setTimeout(() => setXpFloat(null), 1100);
    }
    toggle(q, day);
  }

  return (
    <div>
      {/* quests */}
      <div className="flex items-center justify-between mb-3.5">
        <h1 className="display text-[19px]">Missions</h1>
        <div className="flex items-center gap-3">
          <span className="display text-[15px] text-muted">
            {clearedCount}/{quests.length}
          </span>
          <Link href="/app/quests" aria-label="Manage quests" className="icon-tile !w-9 !h-9 !rounded-[10px] active:scale-95 transition-transform">
            <Icon name="sliders" size={17} />
          </Link>
        </div>
      </div>

      {error && <p className="text-danger text-sm mb-3">{error}</p>}

      <div className="flex flex-col gap-3 stagger">
        {quests.map((q) => {
          const done = doneToday.has(q.id);
          return (
            <button
              key={q.id}
              onClick={() => log(q, "today")}
              disabled={pendingId === q.id}
              className="relative overflow-hidden rounded-2xl text-left transition-transform duration-150 active:scale-[0.985]"
              style={{
                border: done ? "1px solid rgb(var(--accent-rgb) / 0.75)" : "1px solid var(--line)",
                boxShadow: done ? "0 0 22px rgb(var(--accent-rgb) / 0.16)" : "none",
                minHeight: 96,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={questArt(q.pillar)}
                alt=""
                aria-hidden
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ filter: done ? "saturate(0.6) brightness(0.75)" : "none" }}
              />
              <span
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(10,9,8,0.94) 0%, rgba(10,9,8,0.78) 42%, rgba(10,9,8,0.35) 75%, rgba(10,9,8,0.2) 100%)",
                }}
              />
              {done && (
                <span aria-hidden className="absolute inset-0" style={{ background: "rgb(var(--accent-rgb) / 0.10)" }} />
              )}
              <span className="relative flex items-center gap-3.5 px-4 py-4 min-h-[96px]">
                <span
                  className="icon-tile !bg-[rgba(0,0,0,0.35)]"
                  style={{ backdropFilter: "blur(4px)", color: done ? "var(--accent)" : "var(--ink)", borderColor: done ? "rgb(var(--accent-rgb) / 0.5)" : "var(--line-strong)" }}
                >
                  <Icon name={PILLAR_ICONS[q.pillar]} size={23} />
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={`block text-[16px] font-semibold truncate ${done ? "line-through" : ""}`}
                    style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)", color: done ? "var(--muted)" : "var(--ink)" }}
                  >
                    {q.title}
                  </span>
                  <span className="hud-label mt-1.5 !text-[10px]" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
                    {q.pillar} · +{q.xp} XP
                  </span>
                </span>
                <span
                  key={done ? "done" : "todo"}
                  className={`w-8 h-8 rounded-[10px] border flex items-center justify-center flex-none transition-colors duration-150 ${done ? "check-pop" : ""}`}
                  style={
                    done
                      ? { background: "linear-gradient(180deg, var(--accent-2), var(--accent))", borderColor: "var(--accent)", color: "#fff", boxShadow: "0 0 16px rgb(var(--accent-rgb) / 0.6)" }
                      : { borderColor: "rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.3)", color: "transparent", backdropFilter: "blur(4px)" }
                  }
                  aria-hidden
                >
                  <Icon name="check" size={15} strokeWidth={2.6} />
                </span>
                {xpFloat?.id === q.id && (
                  <span className="xp-float absolute right-4 top-1 font-mono font-bold text-sm">
                    +{xpFloat.amount} XP
                  </span>
                )}
              </span>
            </button>
          );
        })}
        {quests.length === 0 && (
          <div className="card p-6 text-center text-muted text-sm">
            No active quests. Open the quest manager to build your loadout.
          </div>
        )}
      </div>

      {/* yesterday: one day of grace to log what you forgot */}
      {yesterdayQuests.length > 0 && (
        <div className="mt-5">
          <button
            className="card w-full px-4 py-3.5 flex items-center gap-3 active:scale-[0.99] transition-transform"
            onClick={() => setShowYesterday(!showYesterday)}
          >
            <span className="icon-tile !w-9 !h-9 !rounded-[10px] text-muted">
              <Icon name="calendar" size={16} />
            </span>
            <span className="flex-1 text-left">
              <span className="display block text-[14px]">Yesterday</span>
              <span className="hud-label mt-0.5">
                {yesterdayQuests.filter((q) => !doneYesterday.has(q.id)).length === 0
                  ? "All cleared"
                  : `${yesterdayQuests.filter((q) => !doneYesterday.has(q.id)).length} open`}
              </span>
            </span>
            <span
              className="text-muted transition-transform duration-300"
              style={{ transform: showYesterday ? "rotate(180deg)" : "none" }}
            >
              <Icon name="chevron-down" size={17} />
            </span>
          </button>

          {showYesterday && (
            <div className="flex flex-col gap-2.5 mt-2.5 stagger">
              {yesterdayQuests.map((q) => {
                const done = doneYesterday.has(q.id);
                return (
                  <button
                    key={q.id}
                    onClick={() => log(q, "yesterday")}
                    disabled={pendingId === q.id}
                    className="relative overflow-hidden rounded-2xl text-left transition-transform duration-150 active:scale-[0.985]"
                    style={{
                      border: done ? "1px solid rgb(var(--accent-rgb) / 0.75)" : "1px solid var(--line)",
                      boxShadow: done ? "0 0 18px rgb(var(--accent-rgb) / 0.14)" : "none",
                      minHeight: 76,
                      opacity: done ? 1 : 0.85,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={questArt(q.pillar)}
                      alt=""
                      aria-hidden
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ filter: done ? "saturate(0.6) brightness(0.7)" : "saturate(0.85) brightness(0.85)" }}
                    />
                    <span
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(10,9,8,0.94) 0%, rgba(10,9,8,0.8) 42%, rgba(10,9,8,0.4) 75%, rgba(10,9,8,0.25) 100%)",
                      }}
                    />
                    {done && (
                      <span aria-hidden className="absolute inset-0" style={{ background: "rgb(var(--accent-rgb) / 0.10)" }} />
                    )}
                    <span className="relative flex items-center gap-3.5 px-4 py-3 min-h-[76px]">
                      <span
                        className="icon-tile !w-10 !h-10 !bg-[rgba(0,0,0,0.35)]"
                        style={{ backdropFilter: "blur(4px)", color: done ? "var(--accent)" : "var(--ink)", borderColor: done ? "rgb(var(--accent-rgb) / 0.5)" : "var(--line-strong)" }}
                      >
                        <Icon name={PILLAR_ICONS[q.pillar]} size={20} />
                      </span>
                      <span className="flex-1 text-left min-w-0">
                        <span
                          className={`block text-[15px] font-semibold truncate ${done ? "line-through" : ""}`}
                          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.8)", color: done ? "var(--muted)" : "var(--ink)" }}
                        >
                          {q.title}
                        </span>
                        <span className="hud-label mt-1 !text-[10px]" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
                          Yesterday · +{q.xp} XP
                        </span>
                      </span>
                      <span
                        key={done ? "done" : "todo"}
                        className={`w-7 h-7 rounded-[9px] border flex items-center justify-center flex-none ${done ? "check-pop" : ""}`}
                        style={
                          done
                            ? { background: "linear-gradient(180deg, var(--accent-2), var(--accent))", borderColor: "var(--accent)", color: "#fff", boxShadow: "0 0 14px rgb(var(--accent-rgb) / 0.55)" }
                            : { borderColor: "rgba(255,255,255,0.4)", background: "rgba(0,0,0,0.3)", color: "transparent", backdropFilter: "blur(4px)" }
                        }
                        aria-hidden
                      >
                        <Icon name="check" size={13} strokeWidth={2.5} />
                      </span>
                      {xpFloat?.id === q.id && (
                        <span className="xp-float absolute right-4 -top-1 font-mono font-bold text-sm">
                          +{xpFloat.amount} XP
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* what the connected services counted, so the tracking is visible */}
      <AppActivity onXp={onXp} />
    </div>
  );
}
