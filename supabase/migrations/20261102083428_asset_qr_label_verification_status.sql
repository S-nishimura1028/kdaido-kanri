-- Applied to production on 2026-11-02 via Supabase migration tool.
-- Existing records default to 未確認 because the system did not store historical printing evidence.
alter table public.assets
  add column if not exists label_status text not null default '未確認',
  add column if not exists label_status_changed_at timestamptz,
  add column if not exists label_status_changed_by uuid;

do $block$
begin
 if not exists(select 1 from pg_constraint where conrelid='public.assets'::regclass and conname='assets_label_status_check') then
   alter table public.assets add constraint assets_label_status_check
   check (label_status in ('未確認','印刷済み','貼付済み'));
 end if;
end $block$;

create or replace function private.record_asset_label_status_change()
returns trigger
language plpgsql
security invoker
set search_path='pg_catalog','public'
as $fn$
begin
  if tg_op = 'INSERT' then
    new.label_status_changed_at := null;
    new.label_status_changed_by := null;
  elsif new.label_status is distinct from old.label_status then
    new.label_status_changed_at := now();
    new.label_status_changed_by := auth.uid();
  else
    new.label_status_changed_at := old.label_status_changed_at;
    new.label_status_changed_by := old.label_status_changed_by;
  end if;
  return new;
end
$fn$;

drop trigger if exists assets_record_label_status on public.assets;
create trigger assets_record_label_status
 before insert or update on public.assets
 for each row execute function private.record_asset_label_status_change();

comment on column public.assets.label_status is 'QR label verification: 未確認 means no verified record, not proof unprinted; 印刷済み is human confirmation; 貼付済み requires checking the physical label.';
