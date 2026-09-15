-- LABORATORY 4 SECTION A
-- Run this in Supabase SQL Editor.
create extension if not exists "pgcrypto";

create type user_role as enum ('Administrator','Laboratory Staff','Requester / Viewer');
create type equipment_condition as enum ('Good','For Repair','Damaged','Unserviceable');
create type equipment_status as enum ('Available','Borrowed','Maintenance','Unserviceable');
create type borrowing_status as enum ('Pending','Approved','Rejected','Released','Returned','Overdue','Closed');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'Requester / Viewer',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'New User'),
    'Requester / Viewer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, full_name, role)
select
  id,
  coalesce(raw_user_meta_data->>'full_name', email, 'New User'),
  'Requester / Viewer'
from auth.users
on conflict (id) do nothing;

create table if not exists equipment (
  id text primary key,
  name text not null,
  condition equipment_condition not null default 'Good',
  status equipment_status not null default 'Available',
  created_at timestamptz not null default now()
);

create table if not exists borrowing_requests (
  id bigint generated always as identity primary key,
  requester_id uuid not null references profiles(id),
  equipment_id text not null references equipment(id),
  purpose text not null,
  status borrowing_status not null default 'Pending',
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  due_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists maintenance_requests (
  id bigint generated always as identity primary key,
  equipment_id text not null references equipment(id),
  requester_id uuid not null references profiles(id),
  description text not null,
  status text not null default 'Pending',
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id),
  action text not null,
  module text not null,
  record_id text,
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_requests_status on borrowing_requests(status);
create index if not exists idx_requests_requester on borrowing_requests(requester_id);
create index if not exists idx_audit_created on audit_logs(created_at desc);

alter table profiles enable row level security;
alter table equipment enable row level security;
alter table borrowing_requests enable row level security;
alter table maintenance_requests enable row level security;
alter table audit_logs enable row level security;

-- Helper functions
create or replace function public.current_role()
returns user_role language sql stable security definer set search_path=public
as $$ select role from profiles where id=auth.uid() $$;

-- Profiles: users can read their own profile; administrators can read all profiles.
create policy "profiles read own or admin" on profiles for select
using (id=auth.uid() or public.current_role()='Administrator');
create policy "profiles admin update" on profiles for update
using (public.current_role()='Administrator')
with check (public.current_role()='Administrator');

-- Equipment: all authenticated users may view.
create policy "equipment authenticated read" on equipment for select
using (auth.uid() is not null);
create policy "equipment admin insert" on equipment for insert
with check (public.current_role()='Administrator');
create policy "equipment admin update" on equipment for update
using (public.current_role()='Administrator')
with check (public.current_role()='Administrator');
create policy "equipment admin delete" on equipment for delete
using (public.current_role()='Administrator');

-- Borrowing requests.
create policy "requests requester read own" on borrowing_requests for select
using (requester_id=auth.uid() or public.current_role() in ('Administrator','Laboratory Staff'));
create policy "requests requester insert own" on borrowing_requests for insert
with check (requester_id=auth.uid() and status='Pending');
create policy "requests admin update" on borrowing_requests for update
using (public.current_role()='Administrator')
with check (public.current_role()='Administrator');
create policy "requests staff release/return" on borrowing_requests for update
using (public.current_role()='Laboratory Staff')
with check (public.current_role()='Laboratory Staff');

-- Maintenance.
create policy "maintenance read operational" on maintenance_requests for select
using (auth.uid() is not null);
create policy "maintenance create own" on maintenance_requests for insert
with check (requester_id=auth.uid());
create policy "maintenance admin update" on maintenance_requests for update
using (public.current_role()='Administrator')
with check (public.current_role()='Administrator');

-- Audit logs: only administrators may read; authenticated users can insert logs.
create policy "audit admin read" on audit_logs for select
using (public.current_role()='Administrator');
create policy "audit authenticated insert" on audit_logs for insert
with check (user_id=auth.uid());

-- Sample equipment.
insert into equipment(id,name,condition,status) values
('LAP-001','Laboratory Laptop 001','Good','Available'),
('LAP-002','Laboratory Laptop 002','Good','Available'),
('MIC-001','USB Microphone','Good','Available'),
('PROJ-001','LCD Projector','Good','Available'),
('CAM-001','Digital Camera','For Repair','Maintenance')
on conflict (id) do nothing;
