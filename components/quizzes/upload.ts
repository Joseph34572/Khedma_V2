import { createClient } from "@/lib/supabase/client";

/** يرفع الملف مباشرة إلى التخزين عبر رابط موقّع من الخادم (بدون المرور بحد حجم الطلبات) */
export async function uploadToSigned(path: string, token: string, file: File): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase.storage.from("quiz-files").uploadToSignedUrl(path, token, file, { contentType: file.type });
  return error ? "فشل رفع الملف. تحقق من الاتصال وحاول مرة أخرى." : null;
}

export const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
