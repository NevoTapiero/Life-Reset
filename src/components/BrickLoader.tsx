"use client";

// three bricks stacking, the app's loading state
export default function BrickLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3" role="status">
      <div className="flex flex-col-reverse items-center gap-1">
        {["var(--lego-red)", "var(--lego-yellow)", "var(--lego-blue)"].map((c, i) => (
          <span key={c} className="stack-brick" style={{ "--c": c, animationDelay: `${i * 0.18}s` } as React.CSSProperties} />
        ))}
      </div>
      {label && <span className="hud-label">{label}</span>}
    </div>
  );
}
