/**
 * سكريبت لإنشاء المدير العام الأول (يُشغَّل مرة واحدة فقط بعد إعداد قاعدة البيانات).
 * الاستخدام:
 *   node scripts/create-super-admin.mjs "اسم المدير" "01012345678" "كلمة_مرور_قوية"
 *
 * يتطلب متغيرات البيئة: NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY
 * (يمكن تحميلها من ملف .env.local عبر: node --env-file=.env.local scripts/create-super-admin.mjs ...)
 */
import { createClient } from "@supabase/supabase-js";

const [fullName, phoneRaw, password] = process.argv.slice(2);

if (!fullName || !phoneRaw || !password) {
  console.error("الاستخدام: node scripts/create-super-admin.mjs \"الاسم\" \"رقم الهاتف\" \"كلمة المرور\"");
  process.exit(1);
}

function normalizePhone(raw) {
  let digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = "20" + digits.slice(1);
  if (digits.length === 10 && digits.startsWith("1")) digits = "20" + digits;
  return digits;
}

const normalized = normalizePhone(phoneRaw);
const email = `${normalized}@phone.khedma.internal`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: existing } = await supabase.from("profiles").select("id").eq("role", "super_admin").maybeSingle();
if (existing) {
  console.error("يوجد مدير عام بالفعل في النظام. لا يمكن إنشاء أكثر من مدير عام واحد.");
  process.exit(1);
}

const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true
});

if (createError || !created.user) {
  console.error("فشل إنشاء الحساب:", createError?.message);
  process.exit(1);
}

const { error: profileError } = await supabase.from("profiles").insert({
  id: created.user.id,
  full_name: fullName,
  phone_normalized: normalized,
  role: "super_admin",
  stage_id: null
});

if (profileError) {
  console.error("فشل حفظ بيانات الملف الشخصي:", profileError.message);
  await supabase.auth.admin.deleteUser(created.user.id);
  process.exit(1);
}

console.log(`تم إنشاء المدير العام "${fullName}" برقم هاتف ${phoneRaw} بنجاح.`);
