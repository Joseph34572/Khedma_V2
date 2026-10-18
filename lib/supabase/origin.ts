/**
 * مفتاح "الكتابة من سيرفر التطبيق" (migration 0022): قاعدة البيانات بترفض أي
 * INSERT/UPDATE/DELETE باسم مستخدم لو مش جاي معاه الهيدر ده. المستخدم اللي بيكلّم
 * Supabase مباشرة بالتوكن بتاعه (من غير الموقع) معندوش المفتاح، فمش هيقدر يعدّل
 * نشاطه أو حضوره أو المحتوى من غير ما يعدّي على فحوصات وسجل عمليات التطبيق.
 *
 * المفتاح بيتقرا مرة واحدة لكل نسخة سيرفر بمفتاح الخدمة، وعمره ما بيتبعت للمتصفح.
 */
export const APP_ORIGIN_HEADER = "x-khedma-origin";

let cached: { key: string | null; at: number } | null = null;
let inflight: Promise<string | null> | null = null;

// لو القراءة فشلت (مثلًا الكود اتنشر قبل تشغيل 0022) بنحاول تاني بعد دقيقة،
// ولحد ساعتها الطلبات بتعدّي من غير الهيدر — وده طبيعي لأن الفحص لسه مش متفعّل.
const RETRY_AFTER_MS = 60_000;

async function fetchKey(): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/app_origin_key`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        "content-type": "application/json"
      },
      body: "{}",
      cache: "no-store"
    });
    if (!res.ok) return null;
    const key = await res.json();
    return typeof key === "string" && key ? key : null;
  } catch {
    return null;
  }
}

export async function getAppOriginKey(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) cached = null;
  if (cached && (cached.key || Date.now() - cached.at < RETRY_AFTER_MS)) return cached.key;
  if (!inflight) {
    inflight = fetchKey().then((key) => {
      cached = { key, at: Date.now() };
      inflight = null;
      return key;
    });
  }
  return inflight;
}

// رسالة الرفض من trigger الحماية في قاعدة البيانات (0022).
const ORIGIN_REJECTED = "الكتابة المباشرة غير مسموحة";

function withKey(input: RequestInfo | URL, init: RequestInit | undefined, key: string): Promise<Response> {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set(APP_ORIGIN_HEADER, key);
  return fetch(input, { ...init, headers });
}

/** fetch بيضيف هيدر المفتاح لطلبات قاعدة البيانات (REST) بس، مش لطلبات Auth أو التخزين. */
export const fetchWithAppOrigin: typeof fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes("/rest/v1/")) return fetch(input, init);
  const key = await getAppOriginKey();
  if (!key) return fetch(input, init);
  const res = await withKey(input, init, key);

  // لو المفتاح اتغيّر في قاعدة البيانات (مثلًا بعد تدويره)، الكتابة بتترفض بالمفتاح
  // القديم المتخزن؛ نجيب الجديد ونعيد الطلب مرة واحدة بس.
  if (res.status === 403 && (typeof init?.body === "string" || init?.body == null)) {
    const text = await res.clone().text().catch(() => "");
    if (text.includes(ORIGIN_REJECTED)) {
      const fresh = await getAppOriginKey(true);
      if (fresh && fresh !== key) return withKey(input, init, fresh);
    }
  }
  return res;
};
