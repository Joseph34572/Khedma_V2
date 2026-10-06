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
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.includes(pathname)) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png).*)"]
};
