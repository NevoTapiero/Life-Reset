// The name in LEGO-box lettering: chunky white "SOLO" and yellow "LEVELING",
// each with a thick dark outline and a brick-red drop, on a red 2x4 brick.

export default function BrickLogo({ size = 1 }: { size?: number }) {
  const outline = (w: number) =>
    ({
      WebkitTextStroke: `${w * size}px var(--lego-black)`,
      paintOrder: "stroke fill",
    }) as React.CSSProperties;
  return (
    <div className="inline-flex flex-col items-center select-none" style={{ transform: `rotate(-3deg)` }} aria-label="Solo Leveling">
      <span
        className="display-hero relative px-4 pt-1 pb-2 rounded-[14px]"
        style={{
          fontSize: 30 * size,
          color: "#fff",
          background: "var(--lego-red)",
          boxShadow: `inset 0 3px 0 rgb(255 255 255 / 0.35), 0 ${5 * size}px 0 var(--lego-red-edge)`,
          letterSpacing: "0.06em",
          ...outline(7),
        }}
        aria-hidden
      >
        SOLO
      </span>
      <span
        className="display-hero -mt-1"
        style={{
          fontSize: 56 * size,
          color: "var(--lego-yellow)",
          textShadow: `0 ${5 * size}px 0 var(--lego-red-edge)`,
          ...outline(10),
        }}
        aria-hidden
      >
        LEVELING
      </span>
    </div>
  );
}
