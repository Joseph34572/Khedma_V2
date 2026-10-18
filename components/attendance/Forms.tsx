"use client";

import { useActionState } from "react";
import { createMassAction, createSundaySchoolSessionAction, type ActionState } from "@/lib/actions/attendance";
import { STAGE_LABELS, type Stage } from "@/lib/roles";
import { ActionForm, useActionFormStatus } from "@/components/ui/ActionForm";

const initial: ActionState = { error: null, success: null };
const inputClass = "w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none";

function Submit({ label }: { label: string }) {
  const { pending } = useActionFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-primary text-white px-5 py-2.5 font-bold disabled:opacity-60">
      {pending ? "جاري الحفظ..." : label}
    </button>
  );
}

function Messages({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{state.error}</p>}
      {state.success && <p className="text-good text-sm bg-good/10 rounded-lg px-3 py-2">{state.success}</p>}
    </>
  );
}

export function CreateMassForm() {
  const [state, action] = useActionState(createMassAction, initial);
  return (
    <ActionForm action={action} className="bg-white rounded-card border border-line p-5 space-y-3 mb-6">
      <h2 className="font-bold text-ink">إضافة قداس جديد</h2>
      <input name="title_ar" required placeholder="مثال: قداس الأحد" className={inputClass} />
      <input name="mass_date" type="date" required className={inputClass} />
      <Messages state={state} />
      <Submit label="إضافة القداس" />
    </ActionForm>
  );
}

export function CreateSessionForm({ stages }: { stages: Stage[] }) {
  const [state, action] = useActionState(createSundaySchoolSessionAction, initial);
  return (
    <ActionForm action={action} className="bg-white rounded-card border border-line p-5 space-y-3 mb-6">
      <h2 className="font-bold text-ink">إنشاء جلسة مدارس أحد</h2>
      <select name="stage_id" required className={inputClass}>
        {stages.map((s) => (
          <option key={s} value={s}>{STAGE_LABELS[s]}</option>
        ))}
      </select>
      <input name="session_date" type="date" required className={inputClass} />
      <div className="flex gap-2">
        <label className="flex-1 text-sm">من<input name="starts_at" type="time" className={inputClass} /></label>
        <label className="flex-1 text-sm">إلى<input name="ends_at" type="time" className={inputClass} /></label>
      </div>
      <Messages state={state} />
      <Submit label="إنشاء الجلسة" />
    </ActionForm>
  );
}
