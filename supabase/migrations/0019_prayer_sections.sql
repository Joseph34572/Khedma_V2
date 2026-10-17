-- ---------------------------------------------------------------------------
-- 0019: تقسيم كل صلاة من الأجبية لأجزاء (الصلاة الربانية، صلاة الشكر، المزامير،
-- الإنجيل، القطع، التحليل...). الولد بيختار الساعة، بعدين الجزء اللي يبدأ منه،
-- وبيتنقل بين الأجزاء بالسحب يمين وشمال.
--
-- نصوص الصلوات نفسها لازم تكون منقولة من مصدر كنسي معتمد (مش متولّدة بالذكاء
-- الاصطناعي) — راجع 0020 للمصدر وطريقة النقل.
-- ---------------------------------------------------------------------------

create table if not exists prayer_sections (
  id uuid primary key default gen_random_uuid(),
  prayer_content_id uuid not null references prayer_contents(id) on delete cascade,
  sort_order smallint not null,
  title_ar text not null,
  body_ar text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (prayer_content_id, sort_order)
);

drop trigger if exists trg_prayer_sections_updated_at on prayer_sections;
create trigger trg_prayer_sections_updated_at
  before update on prayer_sections
  for each row execute function set_updated_at();

alter table prayer_sections enable row level security;

-- القراءة: أي مستخدم مسجّل، لأجزاء الصلوات المفعّلة بس (نفس قاعدة prayer_contents).
drop policy if exists prayer_sections_select on prayer_sections;
create policy prayer_sections_select on prayer_sections for select
  using (
    auth.uid() is not null
    and exists (select 1 from prayer_contents p where p.id = prayer_content_id and p.is_active)
  );

-- الإدارة: كل الأدوار الخادمة (زي محتوى الصلاة في 0011).
drop policy if exists prayer_sections_staff_write on prayer_sections;
create policy prayer_sections_staff_write on prayer_sections for all
  using (auth_role() <> 'member') with check (auth_role() <> 'member');
