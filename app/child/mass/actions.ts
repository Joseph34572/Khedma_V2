"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function registerMassAttendanceAction(massId: string) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("غير مسجّل الدخول");

  const { error } = await supabase.from("mass_attendance").insert({
    mass_id: massId,
    user_id: user.id,
    method: "self_report"
  });

  if (error) {
    if (error.code === "23505") throw new Error("تم تسجيل حضورك لهذا القداس من قبل.");
    throw new Error("تعذّر تسجيل الحضور.");
  }

  revalidatePath("/child/mass");
}
