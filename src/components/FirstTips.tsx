"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

const KEY = "sl-tips-v1";

// Three lines that explain the game, once. Dismissed for good on this device.
export default function FirstTips() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a device setting once
      setShow(localStorage.getItem(KEY) !== "done");
    } catch {}
  }, []);

  if (!show) return null;

  function close() {
    setShow(false);
    try {
      localStorage.setItem(KEY, "done");
    } catch {}
  }

  const tips = [
    { icon: "check", brick: "var(--lego-green)", text: "Tap a mission when you do it. Doing it days in a row pays more." },
    { icon: "home", brick: "var(--lego-orange)", text: "XP levels up your minifig and builds your house in the world." },
    { icon: "plug", brick: "var(--lego-blue)", text: "Connect your apps on Profile: sleep, steps, workouts and tasks pay on their own." },
  ];

  return (
    <section className="card mt-4 p-4 rise" aria-label="How it works">
      <div className="flex items-center justify-between">
        <span className="display text-[17px]">How it works</span>
        <button className="icon-tile !w-8 !h-8 !rounded-[9px] text-muted" aria-label="Close the tips" onClick={close}>
          <Icon name="x" size={14} strokeWidth={2.6} />
        </button>
      </div>
      <ul className="mt-2.5 flex flex-col gap-2.5">
        {tips.map((t) => (
          <li key={t.icon} className="flex items-center gap-3">
            <span className="grid place-items-center rounded-[10px] flex-none text-white" style={{ width: 32, height: 32, background: t.brick, boxShadow: "inset 0 -2px 0 rgb(0 0 0 / 0.2)" }}>
              <Icon name={t.icon} size={16} strokeWidth={2.6} />
            </span>
            <span className="text-[13.5px] font-bold leading-snug">{t.text}</span>
          </li>
        ))}
      </ul>
      <button className="btn-primary brick-flat w-full py-2.5 mt-5 !text-[15px]" onClick={close}>
        Got it
      </button>
    </section>
  );
}
