create table if not exists public.contractor_enquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  email text not null check (char_length(trim(email)) > 0),
  postcode text not null check (char_length(trim(postcode)) > 0),
  project_type text not null check (char_length(trim(project_type)) > 0),
  budget_range text not null check (char_length(trim(budget_range)) > 0),
  estimate_total numeric(12,2),
  message text,
  created_at timestamptz not null default now(),
  check (estimate_total is null or estimate_total >= 0)
);

alter table public.contractor_enquiries enable row level security;

drop policy if exists "Anyone can submit contractor enquiries" on public.contractor_enquiries;
create policy "Anyone can submit contractor enquiries"
on public.contractor_enquiries
for insert
to anon, authenticated
with check (user_id is null or auth.uid() = user_id);

create index if not exists contractor_enquiries_created_at_idx
  on public.contractor_enquiries (created_at desc);
