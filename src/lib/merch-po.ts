import { supabaseAdmin } from '@/lib/supabase'

const TIDAK_DIHITUNG = new Set(['ditolak', 'batal'])

export async function hitungTerjual(ids: string[]) {
  const terjual = new Map<string, number>()
  if (ids.length === 0) return terjual

  const { data: items } = await supabaseAdmin
    .from('merch_po_item')
    .select('merchandise_id, qty, po_id')
    .in('merchandise_id', ids)

  const poIds = [...new Set((items ?? []).map((i) => i.po_id).filter(Boolean))]
  const { data: orders } = poIds.length
    ? await supabaseAdmin.from('merch_po').select('id, status').in('id', poIds)
    : { data: [] as { id: string; status: string }[] }

  const valid = new Set((orders ?? []).filter((o) => !TIDAK_DIHITUNG.has(o.status)).map((o) => o.id))
  for (const item of items ?? []) {
    if (!valid.has(item.po_id)) continue
    const key = item.merchandise_id as string
    terjual.set(key, (terjual.get(key) ?? 0) + Number(item.qty))
  }
  return terjual
}
