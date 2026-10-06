"use client";

import { useState, useTransition } from "react";
import { registerMassAttendanceAction } from "./actions";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function MassRow({
  massId,
  title,
  dateLabel,
  alreadyAttended
}: {
  massId: string;
  title: string;
  dateLabel: string;
  alreadyAttended: boolean;
}) {
  const [attended, setAttended] = useState(alreadyAttended);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await registerMassAttendanceAction(massId);
        setAttended(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ.");
      }
    });
  }

  return (
    <div className="bg-white rounded-card border border-line p-4 flex items-center justify-between">
      <div>
        <p className="font-bold text-ink">{title}</p>
        <p className="text-xs text-ink-soft mt-0.5">{dateLabel}</p>
        {error && <p className="text-bad text-xs mt-1">{error}</p>}
      </div>
      {attended ? (
        <StatusBadge tone="good">✅ تم التسجيل</StatusBadge>
      ) : (
        <button
          onClick={handleClick}
          disabled={isPending}
          className="rounded-lg bg-primary text-white px-3.5 py-2 text-sm font-bold disabled:opacity-60"
        >
          {isPending ? "..." : "تسجيل حضوري"}
        </button>
      )}
    </div>
  );
}
