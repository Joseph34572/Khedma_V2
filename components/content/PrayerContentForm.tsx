"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { updatePrayerContentAction, type ActionState } from "./prayerActions";
import { StatusBadge } from "@/components/ui/StatusBadge";

const initialState: ActionState = { error: null, success: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-bold disabled:opacity-60">
      {pending ? "جاري الحفظ..." : "حفظ"}
    </button>
  );
}

export function PrayerContentForm({
  id,
  title,
  bodyAr,
  isActive
}: {
  id: string;
  title: string;
  bodyAr: string;
  isActive: boolean;
}) {
  const [state, formAction] = useFormState(updatePrayerContentAction, initialState);
  const [expanded, setExpanded] = useState(!bodyAr);

  return (
    <div className="bg-white rounded-card border border-line p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-ink">{title}</h2>
          {isActive ? <StatusBadge tone="good">مُفعّلة</StatusBadge> : <StatusBadge tone="muted">غير مفعّلة</StatusBadge>}
        </div>
        <button onClick={() => setExpanded((v) => !v)} className="text-sm text-primary font-medium">
          {expanded ? "إخفاء" : "تعديل النص"}
        </button>
      </div>

      {expanded && (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <textarea
            name="body_ar"
            defaultValue={bodyAr}
            rows={8}
            placeholder="الصق نص الصلاة كاملًا هنا من مصدر معتمد..."
            className="w-full rounded-lg border border-line px-3.5 py-2.5 text-sm leading-relaxed focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="is_active" defaultChecked={isActive} />
            تفعيل هذه الصلاة للظهور للأولاد
          </label>
          {state.error && <p className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{state.error}</p>}
          {state.success && <p className="text-good text-sm bg-good/10 rounded-lg px-3 py-2">{state.success}</p>}
          <SaveButton />
        </form>
      )}
    </div>
  );
}
