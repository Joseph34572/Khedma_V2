import Link from "next/link";

/**
 * صفحة 404 مخصّصة — من غير دي، Next.js بيعرض صفحة افتراضية بدون تصميم ولا رابط
 * رجوع، لمسارات غير موجودة (مثلًا مسار مكتوب غلط أو رابط قديم اتشال).
 */
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center" dir="rtl">
      <div>
        <h1 className="text-2xl font-extrabold text-ink mb-2">الصفحة غير موجودة</h1>
        <p className="text-ink-soft mb-6">الرابط اللي فتحته مش موجود، أو اتشال.</p>
        <Link href="/" className="inline-block rounded-lg bg-primary text-white px-5 py-2.5 font-bold">
          الرجوع للرئيسية
        </Link>
      </div>
    </main>
  );
}
