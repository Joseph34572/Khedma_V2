"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createChildAction, type ChildActionState } from "@/lib/actions/children";
import { STAGE_LABELS } from "@/lib/roles";
import { ActionForm, useActionFormStatus } from "@/components/ui/ActionForm";

const initialState: ChildActionState = { error: null, success: null };
const inputClass = "w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none";

function SubmitButton() {
  const { pending } = useActionFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-[16px] bg-primary text-white py-3 font-bold disabled:opacity-60">
      {pending ? "جاري الحفظ..." : "إنشاء حساب الولد"}
    </button>
  );
}

/** إضافة حساب ولد جديد. لو chooseStage = false المرحلة بتتحدد على السيرفر (مرحلة الخادم/الأمين). */
export function NewChildForm({ backHref, chooseStage, stageLabel }: { backHref: string; chooseStage: boolean; stageLabel?: string }) {
  const [state, formAction] = useActionState(createChildAction, initialState);

  return (
    <div className="max-w-lg mx-auto">
      <Link href={backHref} prefetch={false} className="text-sm text-ink-soft hover:underline">‹ رجوع للأولاد</Link>
      <h1 className="text-xl font-extrabold text-ink mt-2 mb-5">إضافة ولد جديد</h1>

      <ActionForm action={formAction} className="bg-white rounded-card border border-line p-5 space-y-4">
        <Field label="اسم الولد">
          <input name="full_name" required className={inputClass} />
        </Field>
        <Field label="رقم الموبايل (هيستخدمه في الدخول)">
          <input name="phone" type="tel" dir="ltr" required className={inputClass} placeholder="01012345678" />
        </Field>
        <Field label="كلمة المرور الأولية (٨ حروف أو أرقام على الأقل)">
          <input name="password" type="text" required minLength={8} className={inputClass} />
        </Field>
        {chooseStage ? (
          <Field label="المرحلة">
            <select name="stage_id" required className={inputClass} defaultValue="">
              <option value="" disabled>اختر المرحلة</option>
              {Object.entries(STAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
        ) : (
          stageLabel && <p className="text-sm text-ink-soft">هيتسجّل في مرحلة: <b className="text-ink">{stageLabel}</b></p>
        )}

        {state.error && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{state.error}</p>}
        {state.success && <p role="status" className="text-good text-sm bg-good/10 rounded-lg px-3 py-2">{state.success}</p>}

        <SubmitButton />
      </ActionForm>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1.5">{label}</span>
      {children}
    </label>
  );
}
