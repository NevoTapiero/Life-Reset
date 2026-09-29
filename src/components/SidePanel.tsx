"use client";

import type { ReactNode } from "react";
import Icon from "@/components/Icon";

// A tab over the world: slides in from the right, the world stays behind it.
export default function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }} />
      <aside
        className="relative h-full w-[88%] max-w-sm overflow-y-auto px-4 pt-5 pb-28 world-panel"
        style={{ background: "var(--bg)", borderLeft: "1px solid var(--line-strong)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="display text-[19px]">{title}</h2>
          <button className="icon-tile !w-9 !h-9 !rounded-[10px]" aria-label={`Close ${title}`} onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
