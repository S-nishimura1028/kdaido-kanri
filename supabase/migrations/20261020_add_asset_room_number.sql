-- Add an optional room number used for physical QR labels.
-- User names remain in assets.user_name for internal management.
-- room_number is intentionally nullable: department-owned items leave it blank.

alter table public.assets
  add column if not exists room_number text;

comment on column public.assets.room_number is
  'Optional room number for the current user. Printed on physical QR labels instead of the user name; leave NULL for department-owned items.';
