/**
 * توحيد صيغة رقم الهاتف لمنع إنشاء أكثر من حساب لنفس الرقم بصيغ مختلفة.
 * الصيغة النهائية المخزّنة دائمًا: كود الدولة + الرقم بدون أصفار أو رموز، مثال: 201012345678
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d]/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);

  // أرقام مصرية محلية تبدأ بصفر (01xxxxxxxxx -> 11 رقم)
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = "20" + digits.slice(1);
  }

  // رقم بدون صفر وبدون كود دولة (1xxxxxxxxx - 10 أرقام) يُفترض مصري
  if (digits.length === 10 && digits.startsWith("1")) {
    digits = "20" + digits;
  }

  if (digits.length < 10 || digits.length > 15) return null;

  return digits;
}

/** بريد إلكتروني وهمي داخلي يُستخدم فقط لتخزين حساب Supabase Auth، ولا يُعرض أبدًا للمستخدم. */
export function phoneToAuthEmail(normalizedPhone: string): string {
  return `${normalizedPhone}@phone.khedma.internal`;
}

export function formatPhoneForDisplay(normalizedPhone: string): string {
  if (normalizedPhone.startsWith("20") && normalizedPhone.length === 12) {
    return "0" + normalizedPhone.slice(2);
  }
  return "+" + normalizedPhone;
}
