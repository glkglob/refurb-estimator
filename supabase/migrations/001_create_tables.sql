-- Scenarios table
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  input jsonb not null,
  result jsonb not null,
  purchase_price numeric,
  gdv numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security
alter table public.scenarios enable row level security;

create policy "Users can view own scenarios"
  on public.scenarios for select
  using (auth.uid() = user_id);

create policy "Users can insert own scenarios"
  on public.scenarios for insert
  with check (auth.uid() = user_id);

create policy "Users can update own scenarios"
  on public.scenarios for update
  using (auth.uid() = user_id);

create policy "Users can delete own scenarios"
  on public.scenarios for delete
  using (auth.uid() = user_id);

-- Budget actuals table
create table public.budget_actuals (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actuals jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.budget_actuals enable row level security;

create policy "Users can view own budget actuals"
  on public.budget_actuals for select
  using (auth.uid() = user_id);

create policy "Users can insert own budget actuals"
  on public.budget_actuals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own budget actuals"
  on public.budget_actuals for update
  using (auth.uid() = user_id);

create policy "Users can delete own budget actuals"
  on public.budget_actuals for delete
  using (auth.uid() = user_id);

-- Index for fast lookups
create index scenarios_user_id_idx on public.scenarios(user_id);
create index budget_actuals_scenario_id_idx on public.budget_actuals(scenario_id);
create index budget_actuals_user_id_idx on public.budget_actuals(user_id);
