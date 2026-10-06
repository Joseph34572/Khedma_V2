"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { updateUserAction, resetPasswordAction, setUserStatusAction, type ActionState } from "../actions";
import { STAGE_LABELS, ROLE_LABELS, type AppRole, type Stage } from "@/lib/roles";
import { StatusBadge } from "@/components/ui/StatusBadge";

const initialState: ActionState = { error: null, success: null };
const inputClass = "w-full rounded-lg border border-line px-3.5 py-2.5 focus:border-primary focus:ring-1 focus:ring-primary outline-none";

function SaveButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-primary text-white px-5 py-2.5 font-bold disabled:opacity-60">
      {pending ? "جاري الحفظ..." : children}
    </button>
  );
}

export function UserEditForm({
  userId,
  fullName,
  role,
  stageId,
  status,
  isSelf
}: {
  userId: string;
  fullName: string;
  role: string;
  stageId: string | null;
  status: string;
  isSelf: boolean;
}) {
  const [updateState, updateAction] = useFormState(updateUserAction, initialState);
  const [passwordState, passwordAction] = useFormState(resetPasswordAction, initialState);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [pendingStatus, setPendingStatus] = useState(false);

  async function toggleStatus() {
    if (isSelf) return;
    const next = currentStatus === "active" ? "disabled" : "active";
    const confirmMsg =
      next === "disabled" ? "هل تريد تعطيل هذا الحساب فعلًا؟" : "هل تريد إعادة تفعيل هذا الحساب؟";
    if (!window.confirm(confirmMsg)) return;
    setPendingStatus(true);
    try {
      await setUserStatusAction(userId, next);
      setCurrentStatus(next);
    } finally {
      setPendingStatus(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-card border border-line p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-soft mb-1">حالة الحساب</p>
          {currentStatus === "active" ? (
            <StatusBadge tone="good">نشط</StatusBadge>
          ) : (
            <StatusBadge tone="bad">معطّل</StatusBadge>
          )}
        </div>
        <button
          onClick={toggleStatus}
          disabled={isSelf || pendingStatus}
          className="rounded-lg border border-line px-4 py-2 text-sm font-bold disabled:opacity-50"
        >
          {currentStatus === "active" ? "تعطيل الحساب" : "إعادة التفعيل"}
        </button>
      </div>

      <form action={updateAction} className="bg-white rounded-card border border-line p-5 space-y-4">
        <input type="hidden" name="user_id" value={userId} />
        <h2 className="font-bold text-ink">البيانات الأساسية</h2>

        <label className="block">
          <span className="block mb-1.5 text-sm font-medium text-ink">الاسم</span>
          <input name="full_name" defaultValue={fullName} required className={inputClass} />
        </label>

        <label className="block">
          <span className="block mb-1.5 text-sm font-medium text-ink">نوع المستخدم</span>
          <select name="role" defaultValue={role} disabled={isSelf} className={inputClass}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block mb-1.5 text-sm font-medium text-ink">المرحلة</span>
          <select name="stage_id" defaultValue={stageId ?? ""} className={inputClass}>
            <option value="">— بدون مرحلة —</option>
            {Object.entries(STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        {isSelf && <p className="text-xs text-ink-soft">لا يمكنك تغيير نوع حسابك الخاص.</p>}
        {updateState.error && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{updateState.error}</p>}
        {updateState.success && <p className="text-good text-sm bg-good/10 rounded-lg px-3 py-2">{updateState.success}</p>}

        <SaveButton>حفظ التعديلات</SaveButton>
      </form>

      <form action={passwordAction} className="bg-white rounded-card border border-line p-5 space-y-4">
        <input type="hidden" name="user_id" value={userId} />
        <h2 className="font-bold text-ink">تغيير كلمة المرور</h2>
        <label className="block">
          <span className="block mb-1.5 text-sm font-medium text-ink">كلمة مرور جديدة</span>
          <input name="password" type="text" minLength={6} required className={inputClass} />
        </label>
        {passwordState.error && <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">{passwordState.error}</p>}
        {passwordState.success && <p className="text-good text-sm bg-good/10 rounded-lg px-3 py-2">{passwordState.success}</p>}
        <SaveButton>تغيير كلمة المرور</SaveButton>
      </form>
    </div>
  );
}
