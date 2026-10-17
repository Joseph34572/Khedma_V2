import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ProfileView } from "@/components/ProfileView";

export default async function AccountPage() {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");
  // qr_token ورقم الموبايل مش من ضمن getCurrentProfile، فمحتاجين استعلام واحد إضافي.
  const { data: me } = await supabase
    .from("profiles")
    .select("full_name, role, stage_id, qr_token, phone_normalized")
    .eq("id", user.id)
    .single();
  if (!me) redirect("/login");
  return <ProfileView me={me} />;
}
