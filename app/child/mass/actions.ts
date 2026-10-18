"use server";

import { audit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";
import { canSelfReportMass } from "@/lib/today";

export async function registerMassAttendanceAction(massId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل الدخول" };

  const id = uuidSchema.safeParse(massId);
  if (!id.success) return { error: "القداس غير موجود." };

  const { data: mass } = await supabase.from("masses").select("mass_date").eq("id", id.data).maybeSingle();
  if (!mass) return { error: "القداس غير موجود." };
  // مينفعش الولد يسجّل حضور قداس لسه مجاش، ولا قداس قديم من أسابيع.
  if (!canSelfReportMass(mass.mass_date)) return { error: "التسجيل متاح لقداسات آخر أسبوع بس." };

  const { error } = await supabase.from("mass_attendance").insert({
    mass_id: id.data,
    user_id: user.id,
    method: "self_report"
  });

  if (error) {
    if (error.code === "23505") return { error: "تم تسجيل حضورك لهذا القداس من قبل." };
    return { error: "تعذّر تسجيل الحضور." };
  }

  await audit({ actorId: user.id, action: "self_report_mass", entityType: "mass", entityId: id.data });

  revalidatePath("/child/mass");
  return { ok: true };
}
