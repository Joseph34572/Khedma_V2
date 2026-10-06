"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMassAction, deleteSundaySchoolSessionAction } from "@/lib/actions/attendance";

export function DeleteSheetButton({
  kind,
  id,
  redirectTo
}: {
  kind: "mass" | "sunday_school";
  id: string;
  redirectTo: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const result = kind === "mass" ? await deleteMassAction(id) : await deleteSundaySchoolSessionAction(id);
      if (result.error) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="text-sm text-red-700">متأكد من الحذف؟</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm font-bold disabled:opacity-60"
        >
          {pending ? "جارٍ الحذف…" : "تأكيد الحذف"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-sm text-ink-soft hover:underline">
          إلغاء
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-block rounded-lg border border-red-300 text-red-700 px-3 py-1.5 text-sm font-bold hover:bg-red-50"
      >
        🗑️ حذف الكشف
      </button>
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  );
}
