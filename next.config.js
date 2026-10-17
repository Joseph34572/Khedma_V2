/** @type {import('next').NextConfig} */

// دومين مشروع Supabase (لازم يكون مسموح به في CSP عشان طلبات auth/data/storage تشتغل).
// لو عندك SUPABASE_URL متاح وقت الـ build بناخده منه تلقائيًا، وإلا سيبناه "*" آمن جدًا
// (https: عام) بدل ما نكسر الاتصال بالخطأ.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
})();
const connectSrc = ["'self'", supabaseOrigin ?? "https:", "wss:"].join(" ");

// ملاحظة مهمة (اتجرّبت فعليًا وفشلت): كان فيه محاولة لإحلال 'unsafe-inline' في
// script-src بـ CSP بـ nonce لكل طلب (عبر middleware.ts، زي ما توثيق Next.js
// الرسمي بيوصف). جُرِّب ده فعليًا ببناء production build كامل وتشغيله
// بمتصفح حقيقي (Playwright): النتيجة كانت كل سكريبتات Next.js الأساسية
// (webpack، chunks الصفحات، بيانات الـ hydration) بترفض تمامًا بسبب CSP —
// لأن Next.js 14.2.35 (النسخة المستخدمة هنا) ما بيحطش attribute الـ nonce
// تلقائيًا على السكريبتات دي، عكس المتوقَّع من التوثيق. ده كان هيكسر الموقع
// بالكامل (الصفحة بتوصل بس مفيش تفاعل خالص، زرار الدخول نفسه مش هيشتغل). عشان
// كده رجّعنا 'unsafe-inline' هنا بدل ما نشحن حاجة اتأكدنا إنها بتكسر الموقع.
// لو حد عايز يحاول يحلّها صح مستقبلًا، محتاج يتأكد الأول من نسخة Next.js
// وطريقة حقن الـ nonce بالظبط (ممكن تحتاج ترقية Next.js، أو تمرير الـ nonce
// يدويًا لكل <script> بدل الاعتماد على الحقن التلقائي).
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `img-src 'self' data: blob: ${supabaseOrigin ?? "https:"}`,
  `connect-src ${connectSrc}`,
  `media-src 'self'`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // الكاميرا مسموحة لنفس الأصل فقط (لازمة لمسح رموز QR للحضور)؛ باقي الصلاحيات الحساسة مقفولة.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: csp }
];

// HSTS بيتفعّل فقط في production لأن dev (npm run dev) بيشتغل على http://localhost بدون
// شهادة TLS — تفعيلها هناك ممكن يمنع المتصفح من فتح الموقع تاني على http. ملحقناش
// "preload" أو "includeSubDomains" لأن ده قرار لازم يتاخد يدويًا بعد التأكد إن كل
// الدومينات الفرعية (لو فيه) شغالة على HTTPS بالكامل — راجع قسم "خطوات يدوية" في الرد.
if (process.env.NODE_ENV === "production") {
  securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=63072000" });
}

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "3mb" },
    // كل صفحات التطبيق ديناميكية (بيانات خاصة بكل مستخدم حسب صلاحياته)، فكاش
    // التنقل من جانب العميل (Client Router Cache) الافتراضي (30 ثانية) كان بيورّي
    // أحيانًا محتوى صفحة قديمة عند التنقل بسرعة بين الروابط. بدل ما نعطّله
    // بالكامل (0 ثانية، وده بيزوّد عدد الطلبات للسيرفر ولـ Supabase في كل تنقل
    // ويخلي الموقع حِسّه أبطأ)، خليناه مدة قصيرة (10 ثوانٍ) تكفي لمنع ظهور محتوى
    // قديم في أغلب سيناريوهات الاستخدام الطبيعي، مع تقليل عدد الطلبات المكرّرة.
    staleTimes: { dynamic: 10, static: 180 }
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  }
};

module.exports = nextConfig;
