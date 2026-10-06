import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { canManageContent } from "@/lib/roles";
import { PrayerContentForm } from "./PrayerContentForm";

export async function PrayerContentPage() {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!role || !canManageContent(role)) redirect("/");

  const { data: prayers } = await supabase.from("prayer_contents").select("*").order("sort_order");

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-extrabold text-ink mb-1">محتوى الصلاة</h1>
      <p className="text-ink-soft text-sm mb-6">
        الصق نص كل صلاة من مصدر كنسي معتمد (مثل كتاب الأجبية)، ثم فعّلها ليظهر للأولاد.
        لا تظهر الصلاة في التطبيق إلا بعد التفعيل.
      </p>

      <div className="space-y-4">
        {(prayers ?? []).map((p) => (
          <PrayerContentForm key={p.id} id={p.id} title={p.title_ar} bodyAr={p.body_ar} isActive={p.is_active} />
        ))}
      </div>
    </div>
  );
}
