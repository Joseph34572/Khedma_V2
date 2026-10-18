// سياسة أمان المحتوى (CSP) بـ nonce جديد لكل طلب: أي <script> مش جاي من التطبيق
// نفسه (مثلًا لو حد قدر يحقن HTML في صفحة) مش هيشتغل، بدل 'unsafe-inline' اللي
// كان بيسمح لأي سكريبت مكتوب جوّه الصفحة. Next.js 15 بيقرا الـ nonce من هيدر
// Content-Security-Policy بتاع الطلب ويحطه على كل سكريبتاته تلقائيًا.

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

function supabaseOrigin(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return null;
  }
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

export function buildCsp(nonce: string): string {
  const supabase = supabaseOrigin();
  const isDev = process.env.NODE_ENV !== "production";
  return [
    `default-src 'self'`,
    // 'strict-dynamic': السكريبتات اللي بيحمّلها سكريبت موثوق (أجزاء Next.js، Turnstile)
    // مسموحة؛ 'self' والدومين بيتجاهلوا في المتصفحات الحديثة وموجودين للقديمة بس.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE_ORIGIN}${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self' data:`,
    `img-src 'self' data: blob: ${supabase ?? "https:"}`,
    `connect-src 'self' ${supabase ?? "https:"} wss:`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    // الـ service worker محتاج تصريح صريح لأن 'strict-dynamic' بيلغي 'self' في script-src.
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `media-src 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`
  ].join("; ");
}
