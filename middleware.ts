import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/login"];

// ملاحظة أداء: الـ middleware ده بيشتغل مع كل navigation تقريبًا (الـ matcher تحت)،
// فأي استعلام إضافي هنا (زي قراءة جدول profiles) بيبقى تأخير ثابت على كل صفحة،
// وده كان سبب رئيسي في بطء الموقع المُبلّغ عنه (خصوصًا لو منطقة مشروع Supabase
// بعيدة عن منطقة نشر Vercel). الفحص الوحيد اللي محتاج نعمله هنا فعلًا هو "هل
// المستخدم مسجّل دخول؟" (getUser بيجدد الكوكيز كمان). فحص الدور المسموح بيه لكل
// قسم (admin/servant/child) وفحص تعطيل الحساب بقى يحصل داخل layout كل قسم
// (app/admin/layout.tsx و app/servant/layout.tsx و app/child/layout.tsx) وداخل
// app/page.tsx لصفحة "/" — دول أصلًا بيجيبوا نفس بيانات البروفايل (عبر
// getCurrentProfile المُخزَّنة بـ React cache لكل طلب)، فمفيش أي استعلام إضافي
// جديد، إحنا بس شلنا الاستعلام المكرر اللي كان بيحصل هنا قبل كده.
export async function middleware(request: NextRequest) {
  const { response: sessionResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    // دفاع إضافي (defense in depth): لو أي زائر بعت هيدر x-verified-user-id يدويًا
    // على مسار عام زي /login، نشيله من الطلب الداخلي بدل ما يعدّي زي ما هو. مجرد
    // مسح response.headers مش كافٍ (ده بيأثر على الرد المُرسَل للمتصفح بس، مش على
    // الطلب الداخلي اللي بيوصل لصفحة الـ Server Component)، فلازم نعيد بناء الطلب
    // بنفس الطريقة المستخدمة تحت. الكود الحالي مش بيستخدم getCurrentProfile() على
    // /login أصلًا، فمفيش استغلال فعلي ممكن النهارده، لكن ده يمنع مشكلة لو حد
    // استخدمها هنا بالغلط مستقبلًا.
    const sanitizedHeaders = new Headers(request.headers);
    sanitizedHeaders.delete("x-verified-user-id");
    const publicResponse = NextResponse.next({ request: { headers: sanitizedHeaders } });
    sessionResponse.cookies.getAll().forEach((cookie) => publicResponse.cookies.set(cookie));
    return publicResponse;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // نمرّر هوية المستخدم اللي اتأكدنا منها فعليًا فوق (عن طريق auth.getUser()، وده
  // نداء حقيقي لسيرفر Supabase للتحقق من التوكن) كـ header للطلب الداخلي، عشان
  // getCurrentProfile() في الصفحات متحتاجش تعمل نفس نداء auth.getUser() تاني من
  // الأول — ده كان بيتكرر مرتين لكل صفحة (مرة هنا ومرة في الصفحة) وكل نداء منه
  // رحلة شبكة كاملة لـ Supabase. Headers.set() بيستبدل أي قيمة موجودة بنفس الاسم،
  // فحتى لو المتصفح بعت هيدر بنفس الاسم ده بيتمسح ويتستبدل بالقيمة الحقيقية هنا،
  // يعني محدش بره الكود ده يقدر يزوّره.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-verified-user-id", user.id);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export const config = {
  // ملفات التثبيت (الأيقونات والـ manifest والـ service worker) لازم تتفتح من غير تسجيل دخول.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|apple-touch-icon.png|icon-.*\\.png).*)"]
};
