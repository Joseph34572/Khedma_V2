import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { NewChildForm } from "@/components/children/NewChildForm";
import { STAGE_LABELS, canViewAllStages } from "@/lib/roles";

export default async function NewChildPage() {
  const { user, role, stageId } = await getCurrentProfile();
  if (!user || !role) redirect("/login");
  const global = canViewAllStages(role);
  return (
    <NewChildForm backHref="/servant/children" chooseStage={global} stageLabel={stageId ? STAGE_LABELS[stageId] : undefined} />
  );
}
