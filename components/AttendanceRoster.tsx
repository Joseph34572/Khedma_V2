"use client";

import { useState, useTransition } from "react";
import { recordMassAttendanceAction, recordSundaySchoolAttendanceAction } from "@/lib/actions/attendance";

export function AttendanceRoster({
  kind,
  entityId,
  kids,
  alreadyMarkedIds
}: {
  kind: "mass" | "sunday_school";
  entityId: string;
  kids: { id: string; full_name: string }[];
  alreadyMarkedIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(alreadyMarkedIds));
  const [saved, setSaved] = useState<Set<string>>(new Set(alreadyMarkedIds));
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    setMessage(null);
    const idsToSave = Array.from(selected).filter((id) => !saved.has(id));
    if (idsToSave.length === 0) {
      setMessage("لا يوجد جديد لحفظه.");
      return;
    }
    startTransition(async () => {
      const result =
        kind === "mass" ? await recordMassAttendanceAction(entityId, idsToSave) : await recordSundaySchoolAttendanceAction(entityId, idsToSave);
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      setSaved(new Set(selected));
      setMessage(`تم تسجيل حضور ${idsToSave.length} ولد بنجاح.`);
    });
  }

  return (
    <div>
      <div className="bg-white rounded-card border border-line divide-y divide-line mb-4">
        {kids.map((k) => (
          <label key={k.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer">
            <input type="checkbox" checked={selected.has(k.id)} onChange={() => toggle(k.id)} className="w-4 h-4" />
            <span className="font-medium">{k.full_name}</span>
            {saved.has(k.id) && <span className="text-good text-xs font-bold ms-auto">✅ مسجّل</span>}
          </label>
        ))}
        {kids.length === 0 && <p className="text-ink-soft text-sm p-4">لا يوجد أولاد في هذا النطاق.</p>}
      </div>

      {message && <p className="text-sm mb-3 text-ink-soft">{message}</p>}

      <button
        onClick={handleSubmit}
        disabled={isPending || kids.length === 0}
        className="rounded-lg bg-primary text-white px-5 py-2.5 font-bold disabled:opacity-60"
      >
        {isPending ? "جاري الحفظ..." : `حفظ الحضور (${selected.size} مُختار)`}
      </button>
    </div>
  );
}
