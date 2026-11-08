-- Samakan qty addon pilihan dengan total unit yang dibayar.
-- Sebelumnya qty disimpan per-tenant (mis. 1) tetapi subtotal sudah dikali jumlah_tenant (mis. 2x).
-- Subtotal & harga_akhir tidak diubah; hanya qty agar cocok dengan harga di detail/struk.
with target as (
  select
    t.id,
    jsonb_agg(
      case
        when coalesce((e.item->>'harga_satuan')::numeric, 0) > 0
         and coalesce((e.item->>'qty')::numeric, 0) > 0
         and t.jumlah_tenant > 1
         and coalesce((e.item->>'subtotal')::numeric, 0) =
             coalesce((e.item->>'harga_satuan')::numeric, 0)
             * coalesce((e.item->>'qty')::numeric, 0)
             * t.jumlah_tenant
        then jsonb_set(e.item, '{qty}', to_jsonb((((e.item->>'qty')::numeric) * t.jumlah_tenant)::int))
        else e.item
      end
      order by e.ord
    ) as addon
  from tenants t
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(t.addon) = 'array' then t.addon else '[]'::jsonb end
  ) with ordinality as e(item, ord)
  group by t.id, t.jumlah_tenant
)
update tenants t
set addon = target.addon
from target
where t.id = target.id
  and t.addon is distinct from target.addon;

with target as (
  select
    p.id,
    jsonb_agg(
      case
        when coalesce((e.item->>'harga_satuan')::numeric, 0) > 0
         and coalesce((e.item->>'qty')::numeric, 0) > 0
         and p.jumlah_tenant > 1
         and coalesce((e.item->>'subtotal')::numeric, 0) =
             coalesce((e.item->>'harga_satuan')::numeric, 0)
             * coalesce((e.item->>'qty')::numeric, 0)
             * p.jumlah_tenant
        then jsonb_set(e.item, '{qty}', to_jsonb((((e.item->>'qty')::numeric) * p.jumlah_tenant)::int))
        else e.item
      end
      order by e.ord
    ) as addon
  from pendaftaran_tenant_pub p
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(p.addon) = 'array' then p.addon else '[]'::jsonb end
  ) with ordinality as e(item, ord)
  group by p.id, p.jumlah_tenant
)
update pendaftaran_tenant_pub p
set addon = target.addon
from target
where p.id = target.id
  and p.addon is distinct from target.addon;
