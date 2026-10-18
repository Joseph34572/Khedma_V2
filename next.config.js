/** @type {import('next').NextConfig} */

// سياسة CSP نفسها بتتبني في middleware.ts (lib/csp.ts) بـ nonce جديد لكل طلب،
// فمش موجودة هنا مع باقي الهيدرز الثابتة.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // الكاميرا مسموحة لنفس الأصل فقط (لازمة لمسح رموز QR للحضور)؛ باقي الصلاحيات الحساسة مقفولة.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" }
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
