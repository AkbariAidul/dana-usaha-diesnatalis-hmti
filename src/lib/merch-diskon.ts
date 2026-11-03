import type { DiskonRule } from './types'

export type DiskonMode = 'po' | 'hari_h'

export function normalizeDiskon(input: unknown): DiskonRule[] {
  if (!Array.isArray(input)) return []
  return input.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as Record<string, unknown>
    const minQty = Math.floor(Number(item.min_qty) || 0)
    const nilai = Number(item.nilai) || 0
    if (minQty < 2 || nilai <= 0) return []
    return [{
      min_qty: minQty,
      tipe: item.tipe === 'nominal' ? 'nominal' : 'persen',
      nilai,
      berlaku_po: item.berlaku_po !== false,
      berlaku_hari_h: item.berlaku_hari_h !== false,
    }]
  })
}

export function hitungDiskon(qty: number, harga: number, diskon: unknown, mode: DiskonMode) {
  const subtotal = Math.max(0, Number(harga) || 0) * Math.max(0, Number(qty) || 0)
  const rule = normalizeDiskon(diskon)
    .filter((d) => (mode === 'po' ? d.berlaku_po : d.berlaku_hari_h))
    .filter((d) => qty >= d.min_qty)
    .sort((a, b) => b.min_qty - a.min_qty)[0] ?? null

  let nilaiDiskon = 0
  if (rule) {
    nilaiDiskon = rule.tipe === 'persen'
      ? Math.round(subtotal * Math.min(100, rule.nilai) / 100)
      : Math.min(subtotal, Math.round(rule.nilai))
  }

  return {
    subtotal,
    diskon: nilaiDiskon,
    total: subtotal - nilaiDiskon,
    rule,
  }
}
