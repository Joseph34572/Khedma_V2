"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { updateChildAction, resetChildPasswordAction, setChildStatusAction, type ChildActionState } from "@/lib/actions/children";
import { STAGE_LABELS } from "@/lib/roles";
import { StatusBadge } from "@/components/ui/StatusBadge";

const initialState: ChildActionState = { error: null, success: null };
const inputClass = "w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none";

function SaveButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-primary text-white px-5 py-2.5 font-bold disabled:opacity-60">
      {pending ? "جاري الحفظ..." : children}
    </button>
  );
}

/** إدارة حساب الولد من صفحته (للخدام والأمناء): الاسم/المرحلة، التعطيل، وكلمة المرور. */
export function ChildAccountManager({
  childId,
  fullName,
  stageId,
  status,
  chooseStage
}: {
  childId: string;
  fullName: string;
  stageId: string | null;
  status: string;
  chooseStage: boolean;
}) {
  const [updateState, updateAction] = useFormState(updateChildAction, initialState);
  const [passwordState, passwordAction] = useFormState(resetChildPasswordAction, initialState);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function toggleStatus() {
    const next = currentStatus === "active" ? "disabled" : "active";
    const msg = next === "disabled" ? `تعطيل حساب ${fullName}؟ مش هيقدر يدخل التطبيق لحد ما يتفعّل تاني.` : `إعادة تفعيل حساب ${fullName}؟`;
    if (!window.confirm(msg)) return;
    setPending(true);
    setStatusError(null);
    const res = await setChildStatusAction(childId, next);
    if (res.error) setStatusError(res.error);
    else setCurrentStatus(next);
    setPending(false);
  }

  return (
    <section className="mt-6 space-y-4">
      <h2 className="font-extrabold text-ink">إدارة الحساب</h2>

      <div className="bg-white rounded-card border border-line p-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-soft mb-1">حالة الحساب</p>
          {currentStatus === "active" ? <StatusBadge tone="good">نشط</StatusBadge> : <StatusBadge tone="bad">معطّل</StatusBadge>}
        </div>
        <button
          type="button"
          onClick={toggleStatus}
          disabled={pending}
          className="rounded-lg border border-line px-4 py-2 text-sm font-bold disabled:opacity-50"
        >
          {currentStatus === "active" ? "تعطيل الحساب" : "إعادة التفعيل"}
        </button>
      </div>
      {statusError && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{statusError}</p>}

      <form action={updateAction} className="bg-white rounded-card border border-line p-5 space-y-4">
        <input type="hidden" name="child_id" value={childId} />
        <label className="block">
          <span className="block text-sm font-medium text-ink mb-1.5">الاسم</span>
          <input name="full_name" required defaultValue={fullName} className={inputClass} />
        </label>
        {chooseStage && (
          <label className="block">
            <span className="block text-sm font-medium text-ink mb-1.5">المرحلة</span>
            <select name="stage_id" required defaultValue={stageId ?? ""} className={inputClass}>
              {Object.entries(STAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        )}
        {updateState.error && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{updateState.error}</p>}
        {updateState.success && <p role="status" className="text-good text-sm bg-good/10 rounded-lg px-3 py-2">{updateState.success}</p>}
        <SaveButton>حفظ التعديلات</SaveButton>
      </form>

      <form action={passwordAction} className="bg-white rounded-card border border-line p-5 space-y-4">
        <input type="hidden" name="child_id" value={childId} />
        <label className="block">
          <span className="block text-sm font-medium text-ink mb-1.5">كلمة مرور جديدة</span>
          <input name="password" type="text" required minLength={6} className={inputClass} />
        </label>
        {passwordState.error && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{passwordState.error}</p>}
        {passwordState.success && <p role="status" className="text-good text-sm bg-good/10 rounded-lg px-3 py-2">{passwordState.success}</p>}
        <SaveButton>تغيير كلمة المرور</SaveButton>
      </form>
    </section>
  );
}
