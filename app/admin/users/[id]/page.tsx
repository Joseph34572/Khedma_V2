import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { canManageUsers } from "@/lib/roles";
import { formatPhoneForDisplay } from "@/lib/phone";
import { UserEditForm } from "./UserEditForm";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const { supabase, user, role } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!role || !canManageUsers(role)) redirect("/admin");

  const { data: target } = await supabase
    .from("profiles")
    .select("id, full_name, phone_normalized, role, stage_id, status")
    .eq("id", params.id)
    .single();

  if (!target) notFound();

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-extrabold text-ink mb-1">{target.full_name}</h1>
      <p className="text-ink-soft mb-5" dir="ltr">{formatPhoneForDisplay(target.phone_normalized)}</p>
      <UserEditForm
        userId={target.id}
        fullName={target.full_name}
        role={target.role}
        stageId={target.stage_id}
        status={target.status}
        isSelf={target.id === user.id}
      />
    </div>
  );
}
