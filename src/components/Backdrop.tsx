"use client";

// The gate: painted wallpaper behind the landing and auth screens.
// Wraps the page content so the fixed art layers stack under it reliably.
export default function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url(/walls/gate.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
        }}
      />
      <div
        aria-hidden
        className="fixed inset-0 z-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(12,12,14,0.78) 0%, rgba(12,12,14,0.45) 45%, rgba(12,12,14,0.9) 100%)",
        }}
      />
      <div className="relative z-10 flex-1 flex flex-col">{children}</div>
    </>
  );
}
