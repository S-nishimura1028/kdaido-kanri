-- Independent equipment-user master.
-- User names remain cached in assets.user_name for compatibility/history,
-- while assets.assigned_user_id becomes the durable relationship.
-- サルン is intentionally NOT imported/seeded yet because there are two room assignments.

create table if not exists public.asset_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text,
  room_number text,
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.asset_users enable row level security;

drop policy if exists asset_users_read_admin on public.asset_users;
create policy asset_users_read_admin
  on public.asset_users
  for select
  to authenticated
  using (private.is_admin());

drop policy if exists asset_users_write_admin on public.asset_users;
create policy asset_users_write_admin
  on public.asset_users
  for all
  to authenticated
  using (private.is_admin())
  with check (private.is_admin());

grant select, insert, update, delete on public.asset_users to authenticated;

alter table public.assets
  add column if not exists assigned_user_id uuid references public.asset_users(id) on delete set null;

-- Import current users from existing asset data except サルン.
insert into public.asset_users (name, department, location)
select x.user_name, x.department, x.location
from (
  select distinct on (trim(user_name))
    trim(user_name) as user_name,
    department,
    location
  from public.assets
  where coalesce(is_deleted,false)=false
    and nullif(trim(user_name),'') is not null
    and trim(user_name) <> 'サルン'
  order by trim(user_name), updated_at desc nulls last, created_at desc nulls last
) x
where not exists (
  select 1 from public.asset_users u where u.name = x.user_name
);

-- Backfill the relationship for uniquely named imported users.
update public.assets a
set assigned_user_id = u.id
from public.asset_users u
where a.assigned_user_id is null
  and nullif(trim(a.user_name),'') is not null
  and trim(a.user_name) <> 'サルン'
  and u.name = trim(a.user_name)
  and (
    select count(*) from public.asset_users u2 where u2.name = u.name
  ) = 1;

-- 薄場寮: seed/update the 10 confirmed users. サルン is intentionally omitted.
do $$
declare
  r record;
  uid uuid;
begin
  for r in
    select * from (values
      ('ヴィボル','営農部','101','薄場寮'),
      ('バユ','営農部','102','薄場寮'),
      ('リー','営農部','103','薄場寮'),
      ('アンディカ','営農部','北側和室','薄場寮'),
      ('カイン','農産部','201','薄場寮'),
      ('ラーフェ','営農部','202','薄場寮'),
      ('クアン','農産部','205','薄場寮'),
      ('ハウ','農産部','206','薄場寮'),
      ('キエム','農産部','207','薄場寮'),
      ('ゴックカイン','農産部','208','薄場寮')
    ) as v(name, department, room_number, location)
  loop
    select id into uid
    from public.asset_users
    where name = r.name
    order by created_at
    limit 1;

    if uid is null then
      insert into public.asset_users(name,department,room_number,location,is_active)
      values(r.name,r.department,r.room_number,r.location,true)
      returning id into uid;
    else
      update public.asset_users
      set department=r.department,
          room_number=r.room_number,
          location=r.location,
          is_active=true,
          updated_at=now()
      where id=uid;
    end if;

    update public.assets
    set assigned_user_id=uid,
        user_name=r.name
    where trim(coalesce(user_name,''))=r.name;
  end loop;
end $$;

comment on table public.asset_users is
  'Independent master for equipment users. Room number is stored here so moving rooms only requires one update.';
comment on column public.assets.assigned_user_id is
  'Current assigned equipment user. assets.user_name is retained as a compatibility/display cache.';
