"use client";

import Link from "next/link";
import Backdrop from "@/components/Backdrop";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";

export default function Landing() {
  return (
    <main className="flex-1 flex flex-col py-8">
      <Backdrop>
      <div className="my-auto py-8 text-center rise">
        <div className="flex justify-center mb-6">
          <Logo size={132} />
        </div>

        <h1 className="display-hero text-[76px] leading-[0.92]">
          SOLO
          <br />
          <span
            className="text-accent"
            style={{ textShadow: "0 0 38px rgba(255,107,0,0.55)" }}
          >
            LEVELING
          </span>
        </h1>
        <p className="mt-5 text-muted text-[15px] max-w-xs mx-auto">
          Real habits. Real XP. Level up in real life.
        </p>
      </div>

      <div className="flex flex-col gap-4 rise pb-3 pt-4">
        <Link href="/auth" className="btn-primary py-4 text-[15px]">
          Start leveling
          <span className="btn-icon-slot">
            <Icon name="arrow-right" size={14} strokeWidth={2} />
          </span>
        </Link>
        <Link href="/auth?mode=signin" className="btn-ghost py-3.5">
          I already have an account
        </Link>
      </div>
      </Backdrop>
    </main>
  );
}
