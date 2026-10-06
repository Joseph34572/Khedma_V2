import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { homePathForRole } from "@/lib/roles";

export default async function RootPage() {
  const { supabase, user, role, status } = await getCurrentProfile();

  if (!user) {
    redirect("/login");
  }

  if (!role || status === "disabled") {
    await supabase.auth.signOut();
    redirect("/login");
  }

  redirect(homePathForRole(role));
}
