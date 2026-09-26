"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Radar from "@/components/Radar";
import {
  Answers,
  ChoiceOption,
  FOCUS_LABELS,
  PENDING_KEY,
  QUIZ_KEY,
  QUIZ_STEPS,
  QuizStep,
  buildPayload,
  computeArchetype,
  computeBaselineStats,
} from "@/lib/onboarding";
import {
  PILLARS,
  PILLAR_ICONS,
  PLAN_DAYS,
  Quest,
  STAT_INFO,
  STAT_KEYS,
  formatDate,
  projectedStats,
} from "@/lib/game";

export default function OnboardingPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [idx, setIdx] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(QUIZ_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setAnswers(parsed.answers ?? {});
          setIdx(typeof parsed.idx === "number" ? parsed.idx : 0);
        }
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(QUIZ_KEY, JSON.stringify({ answers, idx }));
    } catch {}
  }, [answers, idx, ready]);

  const visible = useMemo(
    () => QUIZ_STEPS.filter((s) => !s.when || s.when(answers)),
    [answers],
  );
  const step = visible[Math.min(idx, visible.length - 1)];
  const progress = Math.min(idx / visible.length, 1);

  function next() {
    if (idx + 1 >= visible.length) return finish();
    setIdx(idx + 1);
  }

  function back() {
    if (idx > 0) setIdx(idx - 1);
    else router.push("/");
  }

  function finish() {
    const payload = buildPayload(answers);
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
      localStorage.removeItem(QUIZ_KEY);
    } catch {}
    router.push("/auth");
  }

  if (!ready || !step) return null;

  return (
    <main className="flex-1 flex flex-col py-5">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={back} aria-label="Back" className="text-muted text-xl px-1">
          ←
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-panel2 overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300"
            style={{ width: `${Math.max(progress * 100, 3)}%` }}
          />
        </div>
        <div className="hud-label">
          {Math.min(idx + 1, visible.length)}/{visible.length}
        </div>
      </div>

      <div key={step.key} className="flex-1 flex flex-col rise">
        {step.kind === "choice" && (
          <ChoiceStep step={step} answers={answers} setAnswers={setAnswers} next={next} />
        )}
        {step.kind === "multi" && (
          <MultiStep step={step} answers={answers} setAnswers={setAnswers} next={next} />
        )}
        {step.kind === "slider" && (
          <SliderStep step={step} answers={answers} setAnswers={setAnswers} next={next} />
        )}
        {step.kind === "info" && <InfoStep screen={step.screen} answers={answers} next={next} />}
      </div>
    </main>
  );
}

// ---------- question steps ----------

function StepHeading({ question, sub }: { question: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl font-bold leading-snug">{question}</h2>
      {sub && <p className="text-muted mt-2">{sub}</p>}
    </div>
  );
}

function ChoiceStep({
  step,
  answers,
  setAnswers,
  next,
}: {
  step: Extract<QuizStep, { kind: "choice" }>;
  answers: Answers;
  setAnswers: (a: Answers) => void;
  next: () => void;
}) {
  const chosen = answers[step.key];
  const lock = useRef(false);

  function pick(v: string) {
    if (lock.current) return;
    lock.current = true;
    setAnswers({ ...answers, [step.key]: v });
    setTimeout(() => {
      lock.current = false;
      next();
    }, 220);
  }

  return (
    <div>
      <StepHeading question={step.question} sub={step.sub} />
      <div className="flex flex-col gap-3">
        {step.options.map((o) => (
          <button
            key={o.value}
            className={`option-row px-4 py-4 flex items-center gap-3 ${chosen === o.value ? "selected" : ""}`}
            onClick={() => pick(o.value)}
          >
            {o.emoji && <span className="text-xl" aria-hidden>{o.emoji}</span>}
            <span className="flex-1">
              <span className="block">{o.label}</span>
              {o.desc && <span className="block text-sm text-muted mt-0.5">{o.desc}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiStep({
  step,
  answers,
  setAnswers,
  next,
}: {
  step: Extract<QuizStep, { kind: "multi" }>;
  answers: Answers;
  setAnswers: (a: Answers) => void;
  next: () => void;
}) {
  const selected: string[] = Array.isArray(answers[step.key]) ? (answers[step.key] as string[]) : [];

  function toggle(v: string) {
    let out: string[];
    if (selected.includes(v)) {
      out = selected.filter((x) => x !== v);
    } else if (step.exclusiveValue && v === step.exclusiveValue) {
      out = [v];
    } else {
      out = [...selected.filter((x) => x !== step.exclusiveValue), v];
      if (out.length > step.max) return;
    }
    setAnswers({ ...answers, [step.key]: out });
  }

  return (
    <div className="flex-1 flex flex-col">
      <StepHeading question={step.question} sub={step.sub} />
      <div className="flex flex-col gap-3">
        {step.options.map((o) => {
          const on = selected.includes(o.value);
          const order = on && !step.exclusiveValue ? selected.indexOf(o.value) + 1 : null;
          return (
            <button
              key={o.value}
              className={`option-row px-4 py-4 flex items-center gap-3 ${on ? "selected" : ""}`}
              onClick={() => toggle(o.value)}
            >
              {o.emoji && <span className="text-xl" aria-hidden>{o.emoji}</span>}
              <span className="flex-1">{o.label}</span>
              {order !== null && (
                <span className="hud-label !text-accent">#{order}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-auto pt-6 pb-2">
        <button className="btn-primary w-full py-4" disabled={selected.length === 0} onClick={next}>
          Continue
        </button>
      </div>
    </div>
  );
}

function SliderStep({
  step,
  answers,
  setAnswers,
  next,
}: {
  step: Extract<QuizStep, { kind: "slider" }>;
  answers: Answers;
  setAnswers: (a: Answers) => void;
  next: () => void;
}) {
  const value = typeof answers[step.key] === "number" ? (answers[step.key] as number) : 5;

  return (
    <div className="flex-1 flex flex-col">
      <StepHeading question={step.question} sub={step.sub} />
      <div className="card p-6 mt-2">
        <div className="text-center text-5xl font-bold text-accent mb-6">{value}</div>
        <input
          type="range"
          min={step.min}
          max={step.max}
          value={value}
          onChange={(e) => setAnswers({ ...answers, [step.key]: parseInt(e.target.value, 10) })}
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between mt-2">
          <span className="hud-label">{step.minLabel}</span>
          <span className="hud-label">{step.maxLabel}</span>
        </div>
      </div>
      <div className="mt-auto pt-6 pb-2">
        <button className="btn-primary w-full py-4" onClick={next}>
          Continue
        </button>
      </div>
    </div>
  );
}

// ---------- interstitial screens ----------

function InfoShell({
  children,
  next,
  cta = "Continue",
  ctaDisabled = false,
}: {
  children: React.ReactNode;
  next: () => void;
  cta?: string;
  ctaDisabled?: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1">{children}</div>
      <div className="pt-6 pb-2">
        <button className="btn-primary w-full py-4" disabled={ctaDisabled} onClick={next}>
          {cta}
        </button>
      </div>
    </div>
  );
}

function CurveChart({ markers }: { markers: { day: number; label: string }[] }) {
  // habit automation curve: fast early gains that flatten toward day 66
  const w = 320;
  const h = 150;
  const pts = Array.from({ length: 67 }, (_, d) => {
    const x = 10 + (d / 66) * (w - 20);
    const v = 1 - Math.exp(-d / 22);
    const y = h - 16 - v * (h - 40);
    return [x, y] as const;
  });
  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <line x1={10} y1={h - 16} x2={w - 10} y2={h - 16} stroke="var(--line)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
      {markers.map((m) => {
        const [x, y] = pts[m.day];
        return (
          <g key={m.day}>
            <circle cx={x} cy={y} r={4} fill="var(--accent)" />
            <text
              x={x}
              y={h - 2}
              textAnchor="middle"
              fill="var(--muted)"
              style={{ fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
            >
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function InfoStep({
  screen,
  answers,
  next,
}: {
  screen: Extract<QuizStep, { kind: "info" }>["screen"];
  answers: Answers;
  next: () => void;
}) {
  if (screen === "results") return <ResultsScreen answers={answers} next={next} />;
  if (screen === "system") return <SystemScreen answers={answers} next={next} />;
  if (screen === "mechanics") return <MechanicsScreen next={next} />;
  if (screen === "science") return <ScienceScreen next={next} />;
  if (screen === "questcards") return <QuestCardsScreen next={next} />;
  if (screen === "community") return <CommunityScreen next={next} />;
  if (screen === "notifications") return <NotificationsScreen next={next} />;
  if (screen === "boardPreview") return <BoardPreviewScreen next={next} />;
  if (screen === "generating") return <GeneratingScreen next={next} />;
  if (screen === "archetype") return <ArchetypeScreen answers={answers} next={next} />;
  return <StatSheetScreen answers={answers} next={next} />;
}

function ResultsScreen({ answers, next }: { answers: Answers; next: () => void }) {
  const focus: string[] = Array.isArray(answers.focus) ? (answers.focus as string[]) : [];
  const low = answers.satisfaction === "sad" || answers.satisfaction === "lowest";
  return (
    <InfoShell next={next}>
      <div className="hud-label mb-3">Assessment complete</div>
      <h2 className="text-2xl font-bold leading-snug">
        {low ? "After 66 days, you will be on the other side of this." : "After 66 days, this looks very different."}
      </h2>
      <p className="text-muted mt-3">
        Your answers map a clear starting point. The curve below is how habit effort typically
        falls as repetition takes over.
      </p>
      <div className="card p-4 mt-6">
        <CurveChart markers={[{ day: 1, label: "1D" }, { day: 7, label: "7D" }, { day: 15, label: "15D" }, { day: 30, label: "30D" }, { day: 66, label: "66D" }]} />
      </div>
      <div className="flex flex-wrap gap-2 mt-6">
        {focus.map((f) => (
          <span key={f} className="hud-label !text-accent border border-line rounded-full px-3 py-1.5">
            {FOCUS_LABELS[f] ?? f}
          </span>
        ))}
      </div>
      <p className="text-muted text-sm mt-4">Built from your answers, adjusted as you go.</p>
    </InfoShell>
  );
}

function SystemScreen({ answers, next }: { answers: Answers; next: () => void }) {
  const [members, setMembers] = useState<number | null>(null);
  useEffect(() => {
    supabase.rpc("get_member_count").then(({ data }) => setMembers(Number(data ?? 0)));
  }, []);
  const focus: string[] = Array.isArray(answers.focus) ? (answers.focus as string[]) : [];
  const primary = FOCUS_LABELS[focus[0]] ?? "Discipline & habits";
  return (
    <InfoShell next={next} cta="Enter The System">
      <div className="hud-label mb-3 pulse-glow">
        Challenger detected{members !== null && members > 0 ? ` · ${members.toLocaleString()} ${members === 1 ? "reset" : "resets"} initiated` : ""}
      </div>
      <h2 className="text-3xl font-bold">
        Welcome to <span className="text-accent glow-accent">The System</span>.
      </h2>
      <p className="text-muted mt-3">Six pillars hold a life up. Your program trains all of them, starting where you need it most.</p>
      <div className="grid grid-cols-3 gap-3 mt-6">
        {PILLARS.map((p) => (
          <div key={p} className="card p-3 text-center">
            <div className="text-2xl" aria-hidden>{PILLAR_ICONS[p]}</div>
            <div className="hud-label mt-1.5">{p}</div>
          </div>
        ))}
      </div>
      <div className="card p-4 mt-6 border-l-2 border-l-[var(--accent)]">
        <div className="hud-label mb-1">Your primary focus</div>
        <div className="font-semibold">{primary}</div>
        <p className="text-muted text-sm mt-2">
          Most people focus on adding good habits. The real leverage is removing the friction that
          makes your current routine hard. We start there.
        </p>
      </div>
    </InfoShell>
  );
}

function MechanicsScreen({ next }: { next: () => void }) {
  const sample = [
    { icon: "💧", title: "Drink water", xp: 10 },
    { icon: "📖", title: "Read 10 pages", xp: 15 },
    { icon: "☀️", title: "Morning sunlight", xp: 10 },
    { icon: "😴", title: "Sleep 7 to 9 hours", xp: 15 },
  ];
  return (
    <InfoShell next={next}>
      <div className="hud-label mb-3">Sample quests</div>
      <h2 className="text-2xl font-bold leading-snug">Every task is a quest.</h2>
      <p className="text-muted mt-3">
        Each one is a real action in your real life: water, pages, sunlight, sleep. Clear it and
        The System pays you XP. Your challenger, you, gets stronger on both sides of the screen.
      </p>
      <div className="flex flex-col gap-2.5 mt-6">
        {sample.map((q) => (
          <div key={q.title} className="card px-4 py-3 flex items-center gap-3">
            <span className="text-xl" aria-hidden>{q.icon}</span>
            <span className="flex-1">{q.title}</span>
            <span className="hud-label !text-accent">+{q.xp} XP</span>
          </div>
        ))}
      </div>
      <div className="card p-4 mt-4 flex items-center justify-between">
        <span className="hud-label">Rank ladder</span>
        <span className="font-mono text-sm">
          <span style={{ color: "#c9885a" }}>Bronze</span> → <span style={{ color: "#b9c4d6" }}>Silver</span> →{" "}
          <span className="text-gold">Gold</span> → <span style={{ color: "#7fe3e0" }}>Platinum</span> →{" "}
          <span style={{ color: "#8ea2ff" }}>Diamond</span>
        </span>
      </div>
    </InfoShell>
  );
}

function ScienceScreen({ next }: { next: () => void }) {
  return (
    <InfoShell next={next}>
      <div className="hud-label mb-3">The System: calibration data</div>
      <h2 className="text-2xl font-bold leading-snug">Why 66 days?</h2>
      <p className="text-muted mt-3">
        Habits automate on a curve, not a deadline. Repetition stops feeling like effort along this
        curve, and day 66 is the median point where it does.
      </p>
      <div className="card p-4 mt-6">
        <CurveChart markers={[{ day: 1, label: "Day 1" }, { day: 21, label: "Day 21" }, { day: 66, label: "Day 66" }]} />
      </div>
      <div className="card p-4 mt-4">
        <div className="hud-label mb-1">Source</div>
        <p className="text-sm text-muted">
          University College London, Lally et al. 2009: in a study of 96 people, new habits took a
          median of 66 days to feel automatic.
        </p>
      </div>
      <p className="mt-4 font-semibold">The System is built on this. 66 days is Campaign 1.</p>
    </InfoShell>
  );
}

function QuestCardsScreen({ next }: { next: () => void }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  useEffect(() => {
    supabase
      .from("quests")
      .select("*")
      .order("sort")
      .limit(8)
      .then(({ data }) => setQuests((data as Quest[]) ?? []));
  }, []);
  return (
    <InfoShell next={next}>
      <div className="hud-label mb-3">The System: your quests</div>
      <h2 className="text-2xl font-bold leading-snug">Level up in here. Level up in real life.</h2>
      <p className="text-muted mt-2">One action, counted twice. Swipe to see each quest measured.</p>
      <div className="flex gap-3 mt-5 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 pb-2">
        {quests.map((q) => (
          <div key={q.id} className="card p-4 min-w-[240px] snap-center shrink-0">
            <div className="text-3xl" aria-hidden>{q.icon}</div>
            <div className="font-semibold mt-2">{q.title}</div>
            <ul className="mt-3 space-y-1.5">
              {(q.benefits ?? []).map((b) => (
                <li key={b} className="text-sm text-muted flex gap-2">
                  <span className="text-accent" aria-hidden>▸</span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {q.stats.map((s) => (
                <span key={s} className="hud-label !text-accent2 border border-line rounded px-1.5 py-0.5">
                  {STAT_INFO[s]?.name ?? s}
                </span>
              ))}
            </div>
          </div>
        ))}
        {quests.length === 0 && <div className="text-muted text-sm py-8">Loading quests…</div>}
      </div>
      <p className="text-xs text-muted mt-3">
        Benefit figures reflect published research on each habit. Individual results vary.
      </p>
    </InfoShell>
  );
}

function CommunityScreen({ next }: { next: () => void }) {
  const stories = [
    { name: "Peter", note: "It worked for me because it is entirely tailor made around where I actually was." },
    { name: "Desmond", note: "Last year I was at rock bottom. The daily quests were the first structure that held." },
    { name: "John", note: "It pushed me to the limit without being impossible. Day 66 felt earned." },
  ];
  return (
    <InfoShell next={next}>
      <div className="hud-label mb-3">Challengers before you</div>
      <h2 className="text-2xl font-bold">Help us build our vision</h2>
      <div className="mt-2 text-gold">★★★★★</div>
      <p className="text-muted text-sm mt-1">The wall fills with real stories as founding members finish their first campaigns.</p>
      <div className="flex flex-col gap-3 mt-5">
        {stories.map((s) => (
          <div key={s.name} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{s.name}</span>
              <span className="hud-label">Sample</span>
            </div>
            <p className="text-sm text-muted mt-1.5">{s.note}</p>
          </div>
        ))}
      </div>
    </InfoShell>
  );
}

function NotificationsScreen({ next }: { next: () => void }) {
  function enable() {
    try {
      if (typeof Notification !== "undefined") {
        Notification.requestPermission().finally(next);
        return;
      }
    } catch {}
    next();
  }
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="text-6xl mb-6" aria-hidden>🔔</div>
        <h2 className="text-2xl font-bold">Daily reminders protect your streak</h2>
        <p className="text-muted mt-3">
          Stay on track: a nudge for your daily quests so you never lose a streak by accident.
        </p>
      </div>
      <div className="pt-6 pb-2 flex flex-col gap-3">
        <button className="btn-primary w-full py-4" onClick={enable}>
          Enable reminders
        </button>
        <button className="btn-ghost w-full py-3.5" onClick={next}>
          Not now
        </button>
      </div>
    </div>
  );
}

function BoardPreviewScreen({ next }: { next: () => void }) {
  const rows = [
    { name: "mochi.dev", xp: 9420 },
    { name: "vex", xp: 8115 },
    { name: "coldbrew", xp: 7890 },
    { name: "aira", xp: 7211 },
  ];
  return (
    <InfoShell next={next}>
      <div className="hud-label mb-3">Preview</div>
      <h2 className="text-2xl font-bold leading-snug">Every quest you clear moves you up a live board.</h2>
      <p className="text-muted mt-2">Not just your own. You join the weekly board the moment you finish setup.</p>
      <div className="card mt-6 divide-y divide-[var(--line)]">
        {rows.map((r, i) => (
          <div key={r.name} className="px-4 py-3 flex items-center gap-3">
            <span className="hud-label w-6">#{i + 1}</span>
            <span className="flex-1 font-mono text-sm">{r.name}</span>
            <span className="hud-label !text-accent">{r.xp.toLocaleString()} XP</span>
          </div>
        ))}
        <div className="px-4 py-3 flex items-center gap-3 bg-panel2">
          <span className="hud-label w-6">#?</span>
          <span className="flex-1 font-mono text-sm text-accent">you</span>
          <span className="hud-label">joining…</span>
        </div>
      </div>
      <p className="text-xs text-muted mt-3">Preview rows. The real board is live inside.</p>
    </InfoShell>
  );
}

function GeneratingScreen({ next }: { next: () => void }) {
  const [pct, setPct] = useState(0);
  const phases = [
    "Reading your assessment",
    "Mapping quests to your pillars",
    "Calibrating difficulty",
    "Locking Campaign 1",
  ];
  useEffect(() => {
    const t = setInterval(() => {
      setPct((p) => (p >= 100 ? 100 : p + 2));
    }, 55);
    return () => clearInterval(t);
  }, []);
  const done = pct >= 100;
  const finish = new Date(Date.now() + (PLAN_DAYS - 1) * 86400000);
  return (
    <InfoShell next={next} cta="Reveal my reset" ctaDisabled={!done}>
      <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
        <div className="hud-label mb-6">{done ? "Calibration complete" : phases[Math.min(Math.floor(pct / 25), 3)]}</div>
        <div className="text-6xl font-bold text-accent glow-accent">{pct}%</div>
        <div className="w-full h-2 rounded-full bg-panel2 overflow-hidden mt-8">
          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        {done && (
          <p className="text-muted mt-8 rise">
            Day 66 lands on <span className="text-ink font-semibold">{formatDate(finish)}</span>.
          </p>
        )}
      </div>
    </InfoShell>
  );
}

function ArchetypeScreen({ answers, next }: { answers: Answers; next: () => void }) {
  const arch = computeArchetype(answers);
  return (
    <InfoShell next={next}>
      <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
        <div className="hud-label mb-4">Your reset type</div>
        <div className="text-7xl mb-6" aria-hidden>
          {arch.key === "phoenix" ? "🐦‍🔥" : arch.key === "warrior" ? "⚔️" : arch.key === "strategist" ? "♟️" : arch.key === "seeker" ? "🧿" : arch.key === "disciplined" ? "🛡️" : "🎮"}
        </div>
        <h2 className="text-3xl font-bold text-accent glow-accent">{arch.name}</h2>
        <div className="hud-label mt-2">{arch.tagline}</div>
        <p className="text-muted mt-5 max-w-sm">{arch.blurb}</p>
      </div>
    </InfoShell>
  );
}

function StatSheetScreen({ answers, next }: { answers: Answers; next: () => void }) {
  const baseline = computeBaselineStats(answers);
  const projected = projectedStats(baseline, (answers.challenge_style as string) ?? "steady");
  return (
    <InfoShell next={next} cta="Accept the contract">
      <div className="hud-label mb-3">Character sheet</div>
      <h2 className="text-2xl font-bold">Day 1 vs Day 66</h2>
      <div className="flex justify-center mt-2">
        <Radar
          labels={[...STAT_KEYS]}
          series={[
            { values: STAT_KEYS.map((k) => projected[k]), stroke: "var(--accent)", fill: "color-mix(in srgb, var(--accent) 14%, transparent)" },
            { values: STAT_KEYS.map((k) => baseline[k]), stroke: "var(--muted)", dashed: true },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        {STAT_KEYS.map((k) => (
          <div key={k} className="card px-4 py-2.5 flex items-center gap-3">
            <span className="hud-label w-9">{k}</span>
            <span className="flex-1 text-sm text-muted">{STAT_INFO[k].name}</span>
            <span className="font-mono text-sm">
              {baseline[k]} <span className="text-muted">→</span>{" "}
              <span className="text-accent font-semibold">{projected[k]}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted mt-3">
        Dashed line is today. The filled shape is the projection if you clear most quests through
        Campaign 1 at your chosen intensity.
      </p>
    </InfoShell>
  );
}
