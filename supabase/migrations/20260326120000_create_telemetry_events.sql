create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (char_length(trim(event_name)) > 0),
  user_id uuid references auth.users(id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(properties) = 'object')
);

alter table public.telemetry_events enable row level security;

drop policy if exists "Anyone can insert telemetry events" on public.telemetry_events;
create policy "Anyone can insert telemetry events"
on public.telemetry_events
for insert
to anon, authenticated
with check (user_id is null or auth.uid() = user_id);

create index if not exists telemetry_events_created_at_idx
  on public.telemetry_events (created_at desc);

create index if not exists telemetry_events_event_name_idx
  on public.telemetry_events (event_name);

create index if not exists telemetry_events_user_id_idx
  on public.telemetry_events (user_id);
