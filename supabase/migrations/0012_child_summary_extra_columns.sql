-- ============================================================================
-- أعمدة إضافية مطلوبة للوحة متابعة الخادم الموسّعة (انظر مواصفة "لوحة متابعة
-- الخادم"): آخر نشاط صلاة/قراءة (بصرف النظر عن اكتمالها)، حالة اليوم لكل
-- منهما، ونسبة النشاط الشهرية. تُضاف الأعمدة في نهاية قائمة SELECT فقط حتى
-- يبقى create or replace view متوافقًا (لا يمكن حذف/إعادة ترتيب أعمدة موجودة).
-- ============================================================================
create or replace view child_activity_summary
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
  ) as weekly_activity_percent,
  -- آخر نشاط صلاة فعلي (أي جلسة، بصرف النظر عن اكتمالها)
  (
    select max(ps.started_at) from prayer_sessions ps where ps.user_id = p.id
  ) as last_prayer_activity_at,
  -- حالة صلاة اليوم: مكتملة / جارية (لم تكتمل بعد) / لا يوجد نشاط اليوم
  (
    select case
      when bool_or(ps.completion_level = 'likely_complete') then 'completed'
      when count(*) > 0 then 'partial'
      else 'none'
    end
    from prayer_sessions ps
    where ps.user_id = p.id and ps.started_at >= date_trunc('day', now())
  ) as today_prayer_status,
  -- آخر نشاط قراءة فعلي (أي جلسة)
  (
    select max(rs.started_at) from bible_reading_sessions rs where rs.user_id = p.id
  ) as last_reading_activity_at,
  (
    select case
      when bool_or(rs.completion_level = 'likely_complete') then 'completed'
      when count(*) > 0 then 'partial'
      else 'none'
    end
    from bible_reading_sessions rs
    where rs.user_id = p.id and rs.started_at >= date_trunc('day', now())
  ) as today_reading_status,
  -- نشاط الشهر الحالي (30 يومًا) بنفس منطق النشاط الأسبوعي
  round(
    (
      (
        select count(distinct date(ps.started_at)) from prayer_sessions ps
        where ps.user_id = p.id and ps.completion_level = 'likely_complete'
          and ps.started_at >= now() - interval '30 days'
      ) + (
        select count(distinct date(rs.started_at)) from bible_reading_sessions rs
        where rs.user_id = p.id and rs.completion_level = 'likely_complete'
          and rs.started_at >= now() - interval '30 days'
      )
    )::numeric / 60 * 100
  ) as monthly_activity_percent
from profiles p
where p.role = 'member' and p.status = 'active';
