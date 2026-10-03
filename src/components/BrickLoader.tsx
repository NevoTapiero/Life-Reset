"use client";

// The app's loading state, like a LEGO game's loading screen: three bricks
// stacking, the label in outlined letters, and a row of studs lighting up.
export default function BrickLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3" role="status">
      <div className="flex flex-col-reverse items-center gap-1">
        {["var(--lego-red)", "var(--lego-yellow)", "var(--lego-blue)"].map((c, i) => (
          <span key={c} className="stack-brick" style={{ "--c": c, animationDelay: `${i * 0.18}s` } as React.CSSProperties} />
        ))}
      </div>
      {label && <span className="display tt-text text-[20px]">{label}</span>}
      <span className="load-studs" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </span>
    </div>
  );
}
