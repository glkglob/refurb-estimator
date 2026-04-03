create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),

  stripe_payment_intent_id text unique not null,
  stripe_customer_id text,
  stripe_checkout_session_id text,

  user_id uuid references auth.users(id) on delete set null,

  amount integer not null,
  currency text not null default 'gbp',

  status text not null,

  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index payment_intents_user_id_idx on public.payment_intents(user_id);
create index payment_intents_status_idx on public.payment_intents(status);
