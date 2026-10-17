-- ---------------------------------------------------------------------------
-- 0018: تقليم سجل العمليات (audit_log) تلقائيًا عشان الجدول ميكبرش من غير حد.
-- ---------------------------------------------------------------------------
-- السجل ده مفيد للمحاسبة (من عمل ايه وإمتى)، لكن من غير تقليم هيفضل يكبر للأبد.
-- بدل ما نعتمد على cron خارجي (معندناش واحد في المشروع ده)، بنعمل trigger بسيط:
-- بعد كل إدراج، باحتمال 2% بس (عشان منعملش DELETE مع كل سطر وده بيبقى تكلفة
-- زيادة من غير داعي) نمسح أي سجل أقدم من 180 يوم. النتيجة: الجدول بيفضل محتوي
-- آخر 6 شهور تقريبًا بس، من غير أي صيانة يدوية.
create or replace function audit_log_prune() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if random() < 0.02 then
    delete from audit_log where created_at < now() - interval '180 days';
  end if;
  return null;
end;
$$;

drop trigger if exists trg_audit_log_prune on audit_log;
create trigger trg_audit_log_prune
  after insert on audit_log
  for each statement
  execute function audit_log_prune();
