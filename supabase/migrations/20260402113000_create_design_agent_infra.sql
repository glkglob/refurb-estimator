create table if not exists public.region_parameters (
  region text primary key,
  loft_cost_multiplier numeric(6,3) not null check (loft_cost_multiplier > 0),
  new_build_cost_multiplier numeric(6,3) not null check (new_build_cost_multiplier > 0),
  tax_rate numeric(5,4) not null check (tax_rate >= 0),
  building_code_rate numeric(5,4) not null check (building_code_rate >= 0),
  contingency_rate numeric(5,4) not null check (contingency_rate >= 0),
  management_fee_rate numeric(5,4) not null check (management_fee_rate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.region_parameters enable row level security;

drop policy if exists "Region parameters are readable" on public.region_parameters;
create policy "Region parameters are readable"
on public.region_parameters
for select
to anon, authenticated
using (true);

insert into public.region_parameters (
  region,
  loft_cost_multiplier,
  new_build_cost_multiplier,
  tax_rate,
  building_code_rate,
  contingency_rate,
  management_fee_rate
)
values
  ('london', 1.280, 1.240, 0.2000, 0.0300, 0.1000, 0.0900),
  ('south_east', 1.150, 1.120, 0.2000, 0.0280, 0.0900, 0.0800),
  ('west_midlands', 1.000, 1.000, 0.2000, 0.0250, 0.0800, 0.0750),
  ('north_west', 0.960, 0.940, 0.2000, 0.0240, 0.0800, 0.0720),
  ('scotland', 1.120, 1.080, 0.2000, 0.0280, 0.0900, 0.0800)
on conflict (region) do update set
  loft_cost_multiplier = excluded.loft_cost_multiplier,
  new_build_cost_multiplier = excluded.new_build_cost_multiplier,
  tax_rate = excluded.tax_rate,
  building_code_rate = excluded.building_code_rate,
  contingency_rate = excluded.contingency_rate,
  management_fee_rate = excluded.management_fee_rate,
  updated_at = now();

create table if not exists public.design_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null default '',
  project_type text not null check (project_type in ('loft', 'new_build')),
  region text not null,
  upload_bucket text not null,
  upload_path text not null,
  image_signed_url text not null,
  prompt text not null,
  seed integer not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  provider text not null,
  model text not null,
  generated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.design_generations enable row level security;

drop policy if exists "Users can view own design generations" on public.design_generations;
create policy "Users can view own design generations"
on public.design_generations
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own design generations" on public.design_generations;
create policy "Users can insert own design generations"
on public.design_generations
for insert
to authenticated
with check (auth.uid() = user_id);

create index if not exists design_generations_user_id_idx
  on public.design_generations (user_id);
create index if not exists design_generations_region_idx
  on public.design_generations (region);
create index if not exists design_generations_created_at_idx
  on public.design_generations (created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'design-uploads',
  'design-uploads',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload own design files" on storage.objects;
create policy "Users can upload own design files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'design-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read own design files" on storage.objects;
create policy "Users can read own design files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'design-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own design files" on storage.objects;
create policy "Users can delete own design files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'design-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);
