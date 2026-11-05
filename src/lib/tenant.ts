import type { KategoriSewa } from './types'

const KODE_TENANT = ['KT-01', 'KT-02']

export function kategoriTenant(list: KategoriSewa[]): KategoriSewa[] {
  return list
    .filter((k) => KODE_TENANT.includes(k.kode))
    .sort((a, b) => a.kode.localeCompare(b.kode))
}

export function lokasiUntukKategori(kode: string | undefined): 'Reguler' | 'Strategis 1' {
  return kode === 'KT-02' ? 'Strategis 1' : 'Reguler'
}
