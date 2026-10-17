"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";

export async function signOutAction() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) await audit({ actorId: user.id, action: "logout", entityType: "session" });
  await supabase.auth.signOut();
  redirect("/login");
}
