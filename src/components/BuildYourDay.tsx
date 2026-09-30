"use client";

import { useEffect, useRef } from "react";
import Icon from "@/components/Icon";
import LegoIcon, { PILLAR_BRICK_COLOR } from "@/components/LegoIcon";
import { PILLAR_BRICK } from "@/lib/brick";
import { PILLAR_ICONS, type Quest } from "@/lib/game";

// The evening recap: today's done missions are a tower of bricks on a
// baseplate, the open ones wait in a tray below. Tap a brick in the tray and
// it drops onto the tower (and the mission is checked, the normal way).
export default function BuildYourDay({
  quests,
  isDone,
  onCheck,
  onClose,
  pendingId,
}: {
  quests: Quest[];
  isDone: (q: Quest) => boolean;
  onCheck: (q: Quest, from: DOMRect) => void;
  onClose: () => void;
  pendingId: string | null;
}) {
  const done = quests.filter(isDone);
  const open = quests.filter((q) => !isDone(q));

  // Focus moves into the dialog (and back to where it was on close), Tab stays
  // inside, Escape closes, the page behind doesn't scroll.
  const box = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key !== "Tab" || !box.current) return;
      const els = box.current.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, []);

  return (
    <div ref={box} className="fixed inset-0 z-50 flex flex-col build-day" role="dialog" aria-modal="true" aria-label="Build your day">
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col px-4 pt-5 min-h-0">
        <div className="flex items-center justify-between">
          <div>
            <div className="hud-label !text-white/80">Evening check</div>
            <h2 className="display text-[28px] text-white" style={{ textShadow: "0 2px 0 rgb(0 0 0 / 0.15)" }}>
              Build your day
            </h2>
          </div>
          <button ref={closeBtn} className="icon-tile !w-11 !h-11 !bg-white" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={18} strokeWidth={2.6} />
          </button>
        </div>

        {/* the tower: today's done missions, newest on top */}
        <div className="flex-1 min-h-0 flex flex-col justify-end items-center pb-2 overflow-y-auto no-scrollbar">
          {done.length === 0 && <p className="text-white/90 font-extrabold text-[15px] text-center mb-6">Tap what you did today. Every mission is a brick.</p>}
          <div className="flex flex-col-reverse items-center gap-[3px] w-full">
            {done.map((q, i) => (
              <div
                key={q.id}
                className="day-brick"
                style={{ "--c": PILLAR_BRICK[q.pillar] ?? "var(--lego-blue)", width: `${72 - (i % 3) * 6}%` } as React.CSSProperties}
              >
                <span className="truncate">{q.title}</span>
              </div>
            ))}
          </div>
          <div className="day-plate" aria-hidden />
          <div className="mt-2 chip chip-yellow !text-[13px]">
            {done.length} of {quests.length} built today
          </div>
        </div>

        {/* the tray */}
        <div className="card p-3 mb-4">
          {open.length === 0 ? (
            <div className="text-center py-3">
              <p className="display text-[19px]">Your day is built</p>
              <button className="btn-primary brick-yellow px-6 py-3 mt-3" onClick={onClose}>
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="text-[12.5px] font-extrabold text-muted px-1 mb-2">Still open: tap to add it</div>
              <div className="grid grid-cols-2 gap-2 max-h-[34vh] overflow-y-auto no-scrollbar">
                {open.map((q) => (
                  <button
                    key={q.id}
                    disabled={pendingId === q.id}
                    onClick={(e) => onCheck(q, e.currentTarget.getBoundingClientRect())}
                    className="option-row !px-2 !py-2 flex items-center gap-2 text-left"
                  >
                    <LegoIcon name={PILLAR_ICONS[q.pillar as keyof typeof PILLAR_ICONS] ?? "sparkle"} color={PILLAR_BRICK_COLOR[q.pillar] ?? "blue"} size={32} />
                    <span className="text-[13px] font-extrabold leading-tight line-clamp-2">{q.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
