import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { Icon } from "@/components/ui/Icon";
import type { Stage } from "@/lib/roles";

/**
 * زرار "إضافة ولد" + قايمة الحسابات المعطّلة في نطاق المستخدم (RLS). الأولاد
 * المعطّلين مش بيظهروا في جدول المتابعة (العرض بيجيب النشطين بس)، فالقايمة دي
 * هي الطريق لإعادة تفعيلهم من صفحة الولد.
 */
export async function ChildrenManageBar({ basePath, stage }: { basePath: string; stage?: Stage | null }) {
  const { supabase } = await getCurrentProfile();
  let query = supabase.from("profiles").select("id, full_name").eq("role", "member").eq("status", "disabled").order("full_name");
  if (stage) query = query.eq("stage_id", stage);
  const { data: disabled } = await query;

  return (
    <div className="mb-5 space-y-3">
      <Link
        href={`${basePath}/new`}
        prefetch={false}
        className="inline-flex items-center gap-2 rounded-[14px] bg-primary text-white px-5 py-2.5 font-bold"
      >
        <Icon name="user" size={18} />
        إضافة ولد جديد
      </Link>
      {disabled && disabled.length > 0 && (
        <details className="bg-white rounded-card border border-line p-4">
          <summary className="cursor-pointer font-bold text-ink">
            حسابات معطّلة ({disabled.length.toLocaleString("ar-EG")})
          </summary>
          <ul className="mt-3 flex flex-wrap gap-2">
            {disabled.map((c) => (
              <li key={c.id}>
                <Link href={`${basePath}/${c.id}`} prefetch={false} className="inline-block rounded-full border border-line px-3 py-1.5 text-sm hover:border-primary">
                  {c.full_name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
