import type { KategoriSewa } from './types'

export function kategoriTenant(list: KategoriSewa[], includeInactive = false): KategoriSewa[] {
  return list
    .filter((k) => /^KT-\d+$/.test(k.kode) && k.kode !== 'KT-03' && (includeInactive || k.aktif !== false))
    .sort((a, b) => a.kode.localeCompare(b.kode))
}

export function lokasiUntukKategori(kode: string | undefined): 'Reguler' | 'Strategis 1' {
  return kode === 'KT-02' ? 'Strategis 1' : 'Reguler'
}
