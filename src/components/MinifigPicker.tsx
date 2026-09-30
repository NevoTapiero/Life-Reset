"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import { MinifigHead } from "@/components/PlayerAvatar";
import { CHARACTERS, CHARACTER_KEYS, CharacterKey, Profile } from "@/lib/game";

// First run: pick the minifig you'll be in the LEGO world. Shown on Home while
// a player has no character yet; the choice can be changed later on Profile.
export default function MinifigPicker({ onPicked }: { onPicked: (p: Profile) => void }) {
  const [pick, setPick] = useState<CharacterKey>("warrior");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = CHARACTERS[pick];

  async function confirm() {
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc("set_archetype", { p_key: pick });
    setBusy(false);
    if (error) return setError(error.message);
    onPicked(data as Profile);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "rgb(27 42 52 / 0.5)" }} role="dialog" aria-modal="true" aria-label="Choose your minifig">
      <div className="min-h-full flex items-end sm:items-center justify-center p-4">
        <div className="card tile-studs w-full max-w-md p-5 rise">
          <div className="hud-label">Welcome to the town</div>
          <h2 className="display text-[26px] mt-0.5">Choose your minifig</h2>
          <p className="text-[13.5px] font-bold text-muted mt-1">
            This is you in the LEGO world. Every mission you do dresses them up and builds their house.
          </p>

          <div className="flex justify-center mt-5">
            <span className="rounded-full overflow-hidden bounce-in" key={pick} style={{ boxShadow: "0 0 0 5px #fff, 0 9px 0 5px var(--lip)" }}>
              <MinifigHead character={pick} size={120} />
            </span>
          </div>
          <div className="text-center mt-4">
            <div className="display text-[22px]">{c.name}</div>
            <div className="text-[13.5px] font-bold text-muted">{c.focus}</div>
          </div>

          <div className="grid grid-cols-5 gap-2 mt-5">
            {CHARACTER_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => setPick(key)}
                aria-pressed={pick === key}
                aria-label={CHARACTERS[key].name}
                className={`option-row !p-1.5 flex flex-col items-center gap-1 ${pick === key ? "selected" : ""}`}
              >
                <span className="rounded-full overflow-hidden">
                  <MinifigHead character={key} size={46} />
                </span>
                <span className="text-[10px] font-extrabold leading-tight">{CHARACTERS[key].name.replace("The ", "")}</span>
              </button>
            ))}
          </div>

          {error && <p className="text-sm font-bold mt-3" style={{ color: "var(--danger)" }}>{error}</p>}
          <button className="btn-primary brick-yellow w-full py-4 mt-6 !text-[18px]" disabled={busy} onClick={confirm}>
            {busy ? "Building your minifig..." : `Play as the ${c.name.replace("The ", "")}`}
            {!busy && <Icon name="arrow-right" size={18} strokeWidth={2.6} />}
          </button>
          <p className="text-center text-[12px] font-bold text-muted mt-3">You can change this later on your profile.</p>
        </div>
      </div>
    </div>
  );
}
