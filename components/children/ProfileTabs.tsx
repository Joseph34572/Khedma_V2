"use client";

import { useState, type ReactNode } from "react";

type TabSection = { key: string; label: string; content: ReactNode };

export function ProfileTabs({ sections }: { sections: TabSection[] }) {
  const [active, setActive] = useState(sections[0]?.key);

  return (
    <div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 border-b border-line">
        {sections.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActive(s.key)}
            className={`whitespace-nowrap rounded-t-lg px-3.5 py-2 text-sm font-bold border-b-2 ${
              active === s.key ? "border-primary text-primary" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-card border border-line p-5">
        {sections.find((s) => s.key === active)?.content}
      </div>
    </div>
  );
}
