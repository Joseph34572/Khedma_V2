import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/** عميل Supabase لاستخدامه داخل مكونات الخادم والإجراءات (Server Actions). */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
