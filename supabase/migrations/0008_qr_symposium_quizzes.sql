-- ============================================================================
-- 0008: صندوق الندوة (إخفاء هوية حقيقي)، المسابقات (أسئلة + ملفات)، التخزين
-- ============================================================================

-- ---------- دالة وصول عامة لمحتوى المرحلة (تشمل الولد، بعكس can_view_stage) ----------
create or replace function can_access_stage_content(target app_stage) returns boolean
language sql stable security definer set search_path = public as $$
  select auth_status() = 'active'
    and (target is null or is_global_admin() or auth_stage() = target);
$$;

-- ============================================================================
-- صندوق الندوة
-- ============================================================================
create or replace function symposium_prepare_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.stage_id := (select stage_id from profiles where id = new.user_id);
  if new.stage_id is null then
    raise exception 'لا توجد مرحلة لهذا المستخدم';
  end if;
  new.status := 'new';
  new.assigned_to := null;
  return new;
end;
$$;
drop trigger if exists trg_symposium_prepare on symposium_questions;
create trigger trg_symposium_prepare before insert on symposium_questions
  for each row execute function symposium_prepare_insert();

create or replace function can_access_question(q uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() <> 'member', false)
    and exists (select 1 from symposium_questions sq where sq.id = q and can_view_stage(sq.stage_id));
$$;

-- الجدول الأساسي لم يعد مقروءًا للخدام: القراءة عبر عرض يُخفي الهوية عند السؤال المجهول
drop policy if exists symposium_staff_select on symposium_questions;
drop policy if exists symposium_staff_update on symposium_questions;

create or replace view symposium_inbox as
select
  q.id, q.stage_id, q.question_text, q.status, q.created_at, q.updated_at,
  q.assigned_to, ap.full_name as assigned_name, q.is_anonymous,
  case when q.is_anonymous then null else q.user_id end as asker_id,
  case when q.is_anonymous then null else up.full_name end as asker_name
from symposium_questions q
left join profiles up on up.id = q.user_id
left join profiles ap on ap.id = q.assigned_to
where coalesce(auth_role() <> 'member', false) and can_view_stage(q.stage_id);
revoke all on symposium_inbox from anon, public;
grant select on symposium_inbox to authenticated;

drop policy if exists symposium_notes_staff on symposium_question_notes;
create policy symposium_notes_insert on symposium_question_notes for insert
  with check (author_id = auth.uid() and can_access_question(question_id));

create or replace view symposium_notes_view as
select n.id, n.question_id, n.note, n.created_at, n.author_id, p.full_name as author_name
from symposium_question_notes n
join profiles p on p.id = n.author_id
where can_access_question(n.question_id);
revoke all on symposium_notes_view from anon, public;
grant select on symposium_notes_view to authenticated;

create or replace function symposium_set_status(q uuid, s question_status) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_access_question(q) then raise exception 'غير مصرح'; end if;
  update symposium_questions set status = s where id = q;
  insert into audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'change_question_status', 'symposium_question', q::text, jsonb_build_object('status', s));
end;
$$;

create or replace function symposium_assign(q uuid, a uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_access_question(q) then raise exception 'غير مصرح'; end if;
  if a is not null and not exists (
    select 1 from profiles p
    where p.id = a and p.status = 'active' and p.role in ('servant', 'stage_secretary')
      and p.stage_id = (select stage_id from symposium_questions where id = q)
  ) then raise exception 'الخادم المختار ليس من نفس المرحلة'; end if;
  update symposium_questions set assigned_to = a where id = q;
  insert into audit_log (actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'assign_question', 'symposium_question', q::text, jsonb_build_object('assigned_to', a));
end;
$$;
revoke all on function symposium_set_status(uuid, question_status) from public, anon;
revoke all on function symposium_assign(uuid, uuid) from public, anon;
grant execute on function symposium_set_status(uuid, question_status) to authenticated;
grant execute on function symposium_assign(uuid, uuid) to authenticated;

-- ============================================================================
-- المسابقات
-- ============================================================================
alter table quizzes
  add column if not exists quiz_mode text not null default 'questions' check (quiz_mode in ('questions', 'file')),
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists max_score numeric(6,2) not null default 100;

alter table quiz_attempts
  add column if not exists answer_file_path text,
  add column if not exists answer_file_name text,
  add column if not exists feedback text,
  add column if not exists graded_by uuid references profiles(id),
  add column if not exists graded_at timestamptz,
  add column if not exists needs_review boolean not null default false;

-- سياسات المسابقات
drop policy if exists quizzes_select on quizzes;
drop policy if exists quizzes_admin_write on quizzes;
create policy quizzes_select on quizzes for select using (can_access_stage_content(stage_id));
create policy quizzes_staff_insert on quizzes for insert with check (
  auth_status() = 'active' and auth_role() <> 'member' and created_by = auth.uid()
  and (is_global_admin() or (stage_id is not null and stage_id = auth_stage()))
);
create policy quizzes_staff_update on quizzes for update
  using (auth_role() <> 'member' and (created_by = auth.uid() or is_global_admin()))
  with check (auth_role() <> 'member' and (is_global_admin() or (stage_id is not null and stage_id = auth_stage())));
create policy quizzes_staff_delete on quizzes for delete
  using (auth_role() <> 'member' and (created_by = auth.uid() or is_global_admin()));

-- الأسئلة والاختيارات: للخدام فقط (الولد لا يقرأ الإجابات الصحيحة أبدًا؛ يحصل على الأسئلة عبر الخادم)
drop policy if exists quiz_questions_select on quiz_questions;
drop policy if exists quiz_questions_admin_write on quiz_questions;
create policy quiz_questions_staff_select on quiz_questions for select
  using (auth_role() <> 'member' and exists (select 1 from quizzes q where q.id = quiz_id));
create policy quiz_questions_staff_write on quiz_questions for all
  using (auth_role() <> 'member' and exists (select 1 from quizzes q where q.id = quiz_id and (q.created_by = auth.uid() or is_global_admin())))
  with check (auth_role() <> 'member' and exists (select 1 from quizzes q where q.id = quiz_id and (q.created_by = auth.uid() or is_global_admin())));

drop policy if exists quiz_choices_select on quiz_question_choices;
drop policy if exists quiz_choices_admin_write on quiz_question_choices;
create policy quiz_choices_staff_select on quiz_question_choices for select
  using (auth_role() <> 'member' and exists (select 1 from quiz_questions qq where qq.id = question_id));
create policy quiz_choices_staff_write on quiz_question_choices for all
  using (auth_role() <> 'member' and exists (
    select 1 from quiz_questions qq join quizzes q on q.id = qq.quiz_id
    where qq.id = question_id and (q.created_by = auth.uid() or is_global_admin())))
  with check (auth_role() <> 'member' and exists (
    select 1 from quiz_questions qq join quizzes q on q.id = qq.quiz_id
    where qq.id = question_id and (q.created_by = auth.uid() or is_global_admin())));

-- المحاولات والإجابات: الولد يقرأ فقط؛ الإنشاء والتصحيح من الخادم (service role) بعد التحقق
drop policy if exists quiz_attempts_owner on quiz_attempts;
create policy quiz_attempts_owner_select on quiz_attempts for select using (user_id = auth.uid());
drop policy if exists quiz_answers_owner on quiz_answers;
create policy quiz_answers_owner_select on quiz_answers for select
  using (exists (select 1 from quiz_attempts a where a.id = attempt_id and a.user_id = auth.uid()));

-- ============================================================================
-- التخزين: حاوية خاصة؛ لا سياسات مباشرة (كل الوصول عبر روابط موقّعة من الخادم)
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-files', 'quiz-files', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
