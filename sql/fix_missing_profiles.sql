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

alter table public.borrowing_requests add column if not exists due_at timestamptz;

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update
using (public.current_role()='Administrator')
with check (public.current_role()='Administrator');

drop policy if exists "maintenance admin update" on public.maintenance_requests;
create policy "maintenance admin update" on public.maintenance_requests for update
using (public.current_role()='Administrator')
with check (public.current_role()='Administrator');
