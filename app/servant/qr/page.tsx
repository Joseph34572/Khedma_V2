import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { QrCodeCard } from "@/components/QrCodeCard";
import { STAGE_LABELS, ROLE_LABELS, type AppRole, type Stage } from "@/lib/roles";

export default async function AccountPage() {
  const { supabase, user } = await getCurrentProfile();
  if (!user) redirect("/login");
  // qr_token مش من ضمن getCurrentProfile، فلسه محتاجين استعلام واحد إضافي عشانه بس.
  const { data: me } = await supabase.from("profiles").select("full_name, role, stage_id, qr_token").eq("id", user.id).single();
  if (!me) redirect("/login");
  return (
    <div className="max-w-sm">
      <h1 className="text-xl font-extrabold text-ink mb-1">{me.full_name}</h1>
      <p className="text-ink-soft text-sm mb-5">
        {ROLE_LABELS[me.role as AppRole]}{me.stage_id ? ` · ${STAGE_LABELS[me.stage_id as Stage]}` : ""}
      </p>
      <QrCodeCard token={me.qr_token} />
    </div>
  );
}
