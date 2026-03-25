-- Shared estimates table for public, read-only share links.
-- Inserts are performed server-side with service role to keep RLS strict.

create table if not exists public.shared_estimates (
  id uuid default gen_random_uuid() primary key,
  token text unique not null default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '30 days',
  estimate_data jsonb not null,
  user_id uuid references auth.users(id),
  view_count integer default 0
);

alter table public.shared_estimates enable row level security;

-- Public read (non-expired only). API will still query by token.
drop policy if exists "Public can read shared estimates (non-expired)" on public.shared_estimates;
create policy "Public can read shared estimates (non-expired)"
on public.shared_estimates
for select
to anon, authenticated
using (expires_at > now());

-- Optional: authenticated insert for owners only (not required for anonymous sharing).
-- Anonymous inserts are NOT allowed. Anonymous sharing is handled with service role in API.
drop policy if exists "Owner can insert shared estimates" on public.shared_estimates;
create policy "Owner can insert shared estimates"
on public.shared_estimates
for insert
to authenticated
with check (auth.uid() = user_id);

-- Owner can update/delete their own rows (optional; not required but reasonable).
drop policy if exists "Owner can update shared estimates" on public.shared_estimates;
create policy "Owner can update shared estimates"
on public.shared_estimates
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Owner can delete shared estimates" on public.shared_estimates;
create policy "Owner can delete shared estimates"
on public.shared_estimates
for delete
to authenticated
using (auth.uid() = user_id);
