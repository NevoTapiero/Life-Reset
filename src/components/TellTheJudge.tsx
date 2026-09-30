"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import LegoIcon from "@/components/LegoIcon";
import { brickSound } from "@/lib/brickSound";

type Mission = { id: string; title: string };

// Minimal typing for the browser's speech recognition (Chrome, Safari)
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
function makeRecognition(): Recognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const R = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return R ? new R() : null;
}

// "Tell the Judge what you did": one line (typed or spoken) checks every
// mission it clearly matches. The Judge only matches; checking goes through
// the normal mission check, so XP rules stay on the server.
export default function TellTheJudge({ missions, onMatched }: { missions: Mission[]; onMatched: (ids: string[]) => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<{ tone: "ok" | "none"; text: string } | null>(null);
  const [listening, setListening] = useState(false);
  const [canTalk, setCanTalk] = useState(false);
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feature check after mount
    setCanTalk(!!makeRecognition());
  }, []);

  function talk() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = makeRecognition();
    if (!r) return;
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ");
      setText(said);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const said = text.trim();
    if (said.length < 2 || busy) return;
    if (missions.length === 0) {
      setReply({ tone: "none", text: "Everything is already checked today." });
      return;
    }
    setBusy(true);
    setReply(null);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/api/log-text", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ text: said, missions }),
      });
      const out = (await r.json()) as { ids?: string[]; reply?: string };
      const ids = out.ids ?? [];
      if (ids.length === 0) {
        brickSound.error();
        setReply({ tone: "none", text: "That didn't match a mission. Add it as a new mission, or say it another way." });
      } else {
        const names = missions.filter((m) => ids.includes(m.id)).map((m) => m.title);
        setReply({ tone: "ok", text: out.reply || `Checked: ${names.join(", ")}.` });
        setText("");
        await onMatched(ids);
      }
    } catch {
      setReply({ tone: "none", text: "The Judge didn't answer. Try again in a moment." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4">
      <form onSubmit={send} className="judge-bar" aria-label="Tell the Judge what you did">
        <LegoIcon name="sparkle" color="yellow" size={34} studs={1} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? "Listening..." : "What did you do? e.g. ran 5k, read 10 pages"}
          className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-bold placeholder:text-[var(--muted)] placeholder:font-semibold"
          maxLength={300}
          aria-label="What did you do?"
          disabled={busy}
        />
        {canTalk && (
          <button type="button" onClick={talk} className={`judge-mic ${listening ? "on" : ""}`} aria-label={listening ? "Stop listening" : "Say it"} disabled={busy}>
            <Icon name="mic" size={18} strokeWidth={2.4} />
          </button>
        )}
        <button type="submit" className="btn-primary brick-flat brick-yellow !text-[14px] px-3.5 py-2" disabled={busy || text.trim().length < 2}>
          {busy ? "..." : "Log"}
        </button>
      </form>
      {reply && (
        <p className={`mt-2 text-[13px] font-extrabold px-1 ${reply.tone === "ok" ? "" : "text-muted"}`} style={reply.tone === "ok" ? { color: "var(--lego-green-edge)" } : undefined} role="status">
          {reply.text}
        </p>
      )}
    </div>
  );
}
