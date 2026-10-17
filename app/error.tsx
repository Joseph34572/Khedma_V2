"use client";

import { useEffect } from "react";

/**
 * صفحة خطأ عامة لأي استثناء غير متوقَّع يحصل أثناء عرض صفحة (مش نفس حالات
 * "خطأ متوقَّع" اللي الـ Server Actions بترجعها كرسالة عادية). من غيرها،
 * Next.js كان بيعرض شاشة افتراضية بدون تصميم أو أي تسجيل داخلي. ملاحظة أمنية:
 * ما بنعرضش error.message للمستخدم أبدًا (ممكن يكشف تفاصيل داخلية)، وبنكتفي
 * برمز المرجع (digest) اللي Next.js بيولّده، وده المفيد فعليًا لمطابقته مع
 * سجلات الخادم.
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled route error", { digest: error.digest });
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center" dir="rtl">
      <div>
        <h1 className="text-2xl font-extrabold text-ink mb-2">حدث خطأ غير متوقَّع</h1>
        <p className="text-ink-soft mb-2">برجاء المحاولة مرة أخرى. لو المشكلة استمرت، تواصل مع أمين الخدمة.</p>
        {error.digest && <p className="text-xs text-ink-soft mb-6" dir="ltr">رمز المرجع: {error.digest}</p>}
        <button onClick={() => reset()} className="inline-block rounded-lg bg-primary text-white px-5 py-2.5 font-bold">
          إعادة المحاولة
        </button>
      </div>
    </main>
  );
}
