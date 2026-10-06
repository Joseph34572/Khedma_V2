-- ============================================================================
-- تمكين الخدام/الأمناء من رؤية محاولات وإجابات مسابقاتهم (للمراجعة والتصحيح)
-- ============================================================================
create policy quiz_attempts_staff_select on quiz_attempts for select
  using (
    auth_role() <> 'member' and exists (
      select 1 from quizzes q where q.id = quiz_id
        and (q.created_by = auth.uid() or is_global_admin() or (q.stage_id is not null and q.stage_id = auth_stage()))
    )
  );

create policy quiz_answers_staff_select on quiz_answers for select
  using (
    exists (
      select 1 from quiz_attempts a join quizzes q on q.id = a.quiz_id
      where a.id = attempt_id and auth_role() <> 'member'
        and (q.created_by = auth.uid() or is_global_admin() or (q.stage_id is not null and q.stage_id = auth_stage()))
    )
  );
