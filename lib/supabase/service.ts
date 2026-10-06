import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * عميل بمفتاح الخدمة (service role) — يتجاوز RLS بالكامل.
 * يُستخدم فقط داخل إجراءات الخادم للعمليات الإدارية المتحقق من صلاحياتها يدويًا مسبقًا
 * (مثل إنشاء مستخدم جديد أو كتابة سجل العمليات)، ولا يُستورد أبدًا في كود يعمل على المتصفح.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
