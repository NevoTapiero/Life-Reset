import Link from "next/link";
import BrickLogo from "@/components/BrickLogo";
import TapFig from "@/components/TapFig";

// A link to nowhere: a brick is missing from this build.
export default function NotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 text-center">
      <BrickLogo size={0.7} />
      <section className="card mt-20 px-6 pt-5 pb-6 max-w-[340px] w-full">
        <div className="flex justify-center -mt-16">
          <TapFig character="warrior" level={1} size={120} />
        </div>
        <h1 className="display text-[24px] mt-2">This page fell apart</h1>
        <p className="text-[14px] font-bold text-muted mt-1.5">A brick is missing here. The link may be old, or it was never built.</p>
        <Link href="/" className="btn-primary brick-yellow block px-6 py-3 mt-5">
          Back to my town
        </Link>
      </section>
    </main>
  );
}
