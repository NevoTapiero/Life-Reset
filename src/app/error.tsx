"use client";

import { useEffect } from "react";
import Link from "next/link";
import TapFig from "@/components/TapFig";

// Something broke while building a screen: say so plainly, offer a retry.
export default function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 text-center">
      <section className="card px-6 pt-5 pb-6 max-w-[340px] w-full mt-12">
        <div className="flex justify-center -mt-16">
          <TapFig character="guardian" level={1} size={120} />
        </div>
        <h1 className="display text-[24px] mt-2">Something fell apart</h1>
        <p className="text-[14px] font-bold text-muted mt-1.5">Your missions and XP are safe. Try building this screen again.</p>
        <button className="btn-primary brick-yellow w-full px-6 py-3 mt-5" onClick={reset}>
          Try again
        </button>
        <Link href="/app" className="btn-ghost block px-6 py-3 mt-2.5">
          Home
        </Link>
      </section>
    </main>
  );
}
