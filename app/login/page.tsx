"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-card bg-primary text-white py-3 font-bold text-base
                 disabled:opacity-60 transition-colors hover:bg-primary-light"
    >
      {pending ? "جاري الدخول..." : "تسجيل الدخول"}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary flex items-center justify-center">
            <span className="text-2xl text-gold-light font-extrabold">✝</span>
          </div>
          <h1 className="text-2xl font-extrabold text-ink">خدمة إعدادي</h1>
          <p className="text-ink-soft mt-1">تسجيل الدخول لمتابعة الخدمة</p>
        </div>

        <form action={formAction} className="bg-white rounded-card border border-line p-6 space-y-4">
          <div>
            <label htmlFor="phone" className="block mb-1.5 text-sm font-medium text-ink">
              رقم الهاتف
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              dir="ltr"
              className="w-full rounded-lg border border-line px-4 py-3 text-left
                         focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder="01012345678"
            />
          </div>

          <div>
            <label htmlFor="password" className="block mb-1.5 text-sm font-medium text-ink">
              كلمة المرور
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-line px-4 py-3
                         focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder="••••••••"
            />
          </div>

          {state.error && (
            <p role="alert" className="text-bad text-sm bg-bad/10 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </form>

        <p className="text-center text-ink-soft text-sm mt-6">
          لو نسيت كلمة المرور، تواصل مع أمين الخدمة لإعادة تعيينها.
        </p>
      </div>
    </main>
  );
}
