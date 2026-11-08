import type { KategoriSewa } from './types'

export function kategoriTenant(list: KategoriSewa[], includeInactive = false): KategoriSewa[] {
  return list
    .filter((k) => /^KT-\d+$/.test(k.kode) && k.kode !== 'KT-03' && (includeInactive || k.aktif !== false))
    .sort((a, b) => a.kode.localeCompare(b.kode))
}

export function lokasiUntukKategori(kode: string | undefined): 'Reguler' | 'Strategis 1' {
  return kode === 'KT-02' ? 'Strategis 1' : 'Reguler'
}

export function labelJenisUsaha(
  jenis: string | null | undefined,
  qty?: { fnb?: number; nonFnb?: number } | null,
): string {
  const fnb = Number(qty?.fnb ?? 0)
  const nonFnb = Number(qty?.nonFnb ?? 0)
  if (fnb > 0 || nonFnb > 0) {
    const parts: string[] = []
    if (fnb > 0) parts.push(`F&B ${fnb}`)
    if (nonFnb > 0) parts.push(`Non-F&B ${nonFnb}`)
    return parts.join(' · ')
  }
  return jenis || '-'
}
