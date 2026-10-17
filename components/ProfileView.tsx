import { QrCodeCard } from "@/components/QrCodeCard";
import { Icon, type IconName } from "@/components/ui/Icon";
import { formatPhoneForDisplay } from "@/lib/phone";
import { STAGE_LABELS, ROLE_LABELS, type AppRole, type Stage } from "@/lib/roles";

export type ProfileViewData = {
  full_name: string;
  role: string;
  stage_id: string | null;
  qr_token: string;
  phone_normalized: string;
};

/** صفحة الملف الشخصي (بتتفتح من اسم المستخدم في الهيدر): بيانات أساسية + رمز QR للحضور. */
export function ProfileView({ me }: { me: ProfileViewData }) {
  const initial = me.full_name.trim().charAt(0);
  return (
    <div className="max-w-sm mx-auto">
      <section className="bg-white rounded-[24px] border-2 border-line p-5 shadow-[0_6px_0_#ECDFC8] mb-4">
        <div className="flex items-center gap-4 mb-4">
          <span className="h-16 w-16 flex-none rounded-2xl bg-primary text-parchment text-2xl font-extrabold flex items-center justify-center">
            {initial}
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-ink truncate">{me.full_name}</h1>
            <p className="text-sm text-ink-soft">{ROLE_LABELS[me.role as AppRole]}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          {me.stage_id && <InfoItem icon="users" label="المرحلة" value={STAGE_LABELS[me.stage_id as Stage]} />}
          <InfoItem icon="phone" label="رقم الموبايل" value={formatPhoneForDisplay(me.phone_normalized)} ltr />
        </dl>
      </section>
      <QrCodeCard token={me.qr_token} />
    </div>
  );
}

function InfoItem({ icon, label, value, ltr = false }: { icon: IconName; label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-2xl bg-parchment p-3">
      <dt className="flex items-center gap-1.5 text-xs text-ink-soft mb-1">
        <Icon name={icon} size={14} />
        {label}
      </dt>
      <dd className="font-bold text-ink text-right" dir={ltr ? "ltr" : undefined}>
        {value}
      </dd>
    </div>
  );
}
