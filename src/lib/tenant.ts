import type { KategoriSewa } from './types'

export function kategoriTenant(list: KategoriSewa[]): KategoriSewa[] {
  return list
    .filter((k) => /^KT-\d+$/.test(k.kode) && k.kode !== 'KT-03')
    .sort((a, b) => a.kode.localeCompare(b.kode))
}

export function lokasiUntukKategori(kode: string | undefined): 'Reguler' | 'Strategis 1' {
  return kode === 'KT-02' ? 'Strategis 1' : 'Reguler'
}
