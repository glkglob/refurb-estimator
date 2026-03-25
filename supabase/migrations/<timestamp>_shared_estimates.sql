-- Shared estimates table for public share links.
-- Public access should go through a server-side API using the service role.
-- RLS remains strict: no direct anon/authenticated public reads of shared rows.

create table if not exists public.shared_estimates (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  estimate_data jsonb not null,
  user_id uuid references auth.users(id) on delete set null,
  view_count integer not null default 0,
  check (view_count >= 0)
);

alter table public.shared_estimates enable row level security;

-- No public select policy.
-- Reads for public share links should be performed only by server-side API code
-- using the service role and explicit token validation.

drop policy if exists "Public can read shared estimates (non-expired)" on public.shared_estimates;

-- Optional: authenticated users can insert only rows they own.
drop policy if exists "Owner can insert shared estimates" on public.shared_estimates;
create policy "Owner can insert shared estimates"
on public.shared_estimates
for insert
to authenticated
with check (auth.uid() = user_id);

-- Optional: owners can read their own shared estimates.
drop policy if exists "Owner can read shared estimates" on public.shared_estimates;
create policy "Owner can read shared estimates"
on public.shared_estimates
for select
to authenticated
using (auth.uid() = user_id);

-- Optional: owners can update their own rows.
drop policy if exists "Owner can update shared estimates" on public.shared_estimates;
create policy "Owner can update shared estimates"
on public.shared_estimates
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Optional: owners can delete their own rows.
drop policy if exists "Owner can delete shared estimates" on public.shared_estimates;
create policy "Owner can delete shared estimates"
on public.shared_estimates
for delete
to authenticated
using (auth.uid() = user_id);

-- Helpful indexes
create index if not exists shared_estimates_expires_at_idx
  on public.shared_estimates (expires_at);

create index if not exists shared_estimates_user_id_idx
  on public.shared_estimates (user_id);
