import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { fetchWithAppOrigin } from "./origin";

/** عميل Supabase لاستخدامه داخل مكونات الخادم والإجراءات (Server Actions). */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // كل كتابة باسم المستخدم لازم تعدّي من السيرفر ده (راجع origin.ts و migration 0022).
      global: { fetch: fetchWithAppOrigin },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // يتم تجاهلها عند الاستدعاء من مكوّن خادم بحت بدون إمكانية الكتابة؛
            // الـ middleware هو من يتولى تحديث الجلسة في هذه الحالة.
          }
        }
      }
    }
  );
}
