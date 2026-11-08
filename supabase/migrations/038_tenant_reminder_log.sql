-- Log reminder WhatsApp harian per tenant (anti-duplikat per hari)
create table if not exists tenant_reminder_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  tanggal date not null default current_date,
  created_at timestamptz not null default now(),
  unique (tenant_id, tanggal)
);

create index if not exists idx_tenant_reminder_log_tanggal on tenant_reminder_log (tanggal);
