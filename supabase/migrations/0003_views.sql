-- ============================================================================
-- عرض ملخص نشاط الأولاد المستخدم في جدول متابعة الخادم وأمين الخدمة.
-- security_invoker = true يعني أن هذا العرض يحترم سياسات RLS الخاصة بالمستخدم
-- الذي يستعلم عنه فعليًا، وليس صاحب العرض — فلا يكسر نظام الصلاحيات.
-- ============================================================================
create view child_activity_summary
with (security_invoker = true) as
select
  p.id as user_id,
  p.full_name,
  p.stage_id,
  (
    select max(ps.started_at) from prayer_sessions ps
    where ps.user_id = p.id and ps.completion_level = 'likely_complete'
  ) as last_prayer_at,
  (
    select max(rs.started_at) from bible_reading_sessions rs
    where rs.user_id = p.id and rs.completion_level = 'likely_complete'
  ) as last_reading_at,
  (
    select max(m.mass_date) from mass_attendance ma
    join masses m on m.id = ma.mass_id
    where ma.user_id = p.id
  ) as last_mass_date,
  (
    select max(c.confessed_at) from confessions c where c.user_id = p.id
  ) as last_confession_at,
  (
    select max(sss.session_date) from sunday_school_attendance ssa
    join sunday_school_sessions sss on sss.id = ssa.session_id
    where ssa.user_id = p.id
  ) as last_sunday_school_date,
  -- نسبة نشاط تقريبية أولية لآخر 7 أيام (صلاة + قراءة)، قابلة للاستبدال بمعادلة
  -- مأخوذة من app_settings لاحقًا دون تغيير هيكل الجدول.
  round(
    (
      (
        select count(distinct date(ps.started_at)) from prayer_sessions ps
        where ps.user_id = p.id and ps.completion_level = 'likely_complete'
          and ps.started_at >= now() - interval '7 days'
      ) + (
        select count(distinct date(rs.started_at)) from bible_reading_sessions rs
        where rs.user_id = p.id and rs.completion_level = 'likely_complete'
          and rs.started_at >= now() - interval '7 days'
      )
    )::numeric / 14 * 100
  ) as weekly_activity_percent
from profiles p
where p.role = 'member' and p.status = 'active';
