alter table public.payment_intents
drop constraint if exists payment_intents_status_check;

alter table public.payment_intents
add constraint payment_intents_status_check
check (
  status in (
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
    'requires_capture',
    'canceled',
    'succeeded'
  )
);

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_payment_intents_updated_at on public.payment_intents;

create trigger update_payment_intents_updated_at
before update on public.payment_intents
for each row
execute function update_updated_at_column();
