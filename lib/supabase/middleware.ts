import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/** يحدّث جلسة المستخدم في كل طلب ويعيد الاستجابة مع الكوكيز المحدّثة. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        }
      }
    }
  );

  // getClaims() بيتحقق من توقيع التوكن محليًا (بمفاتيح JWKS المتخزنة مؤقتًا) من غير
  // ما يكلّم سيرفر Supabase في كل طلب زي getUser() — ده بيوفّر رحلة شبكة كاملة على
  // كل صفحة. لو المشروع لسه بيستخدم مفتاح متماثل (HS256) هو بيرجع تلقائيًا لـ
  // getUser()، فالأمان واحد في الحالتين. الحساب المعطّل بيتمنع برضه في layout كل قسم
  // (فحص status في profiles)، فمش معتمدين على getUser() عشان نكتشفه.
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  const user = typeof sub === "string" && sub ? { id: sub } : null;

  return { response, user, supabase };
}
