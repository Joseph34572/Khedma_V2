"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { createUserAction, type ActionState } from "../actions";
import { STAGE_LABELS, ROLE_LABELS } from "@/lib/roles";

const initialState: ActionState = { error: null, success: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary text-white px-5 py-2.5 font-bold disabled:opacity-60"
    >
      {pending ? "جاري الحفظ..." : "إنشاء الحساب"}
    </button>
  );
}

export default function NewUserPage() {
  const [state, formAction] = useFormState(createUserAction, initialState);

  return (
    <div className="max-w-lg">
      <Link href="/admin/users" className="text-sm text-ink-soft hover:underline">‹ رجوع للمستخدمين</Link>
      <h1 className="text-xl font-extrabold text-ink mt-2 mb-5">إضافة مستخدم جديد</h1>

      <form action={formAction} className="bg-white rounded-card border border-line p-5 space-y-4">
        <Field label="الاسم">
          <input name="full_name" required className="w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
        </Field>
        <Field label="رقم الهاتف">
          <input name="phone" type="tel" dir="ltr" required className="w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="01012345678" />
        </Field>
        <Field label="كلمة المرور الأولية">
          <input name="password" type="text" required minLength={6} className="w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
        </Field>
        <Field label="نوع المستخدم">
          <select name="role" required className="w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none">
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="المرحلة (إن وجدت)">
          <select name="stage_id" className="w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none">
            <option value="">— بدون مرحلة —</option>
            {Object.entries(STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>

        {state.error && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{state.error}</p>}
        {state.success && <p className="text-good text-sm bg-good/10 rounded-lg px-3 py-2">{state.success}</p>}

        <SubmitButton />
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
