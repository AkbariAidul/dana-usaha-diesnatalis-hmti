import type { Merchandise } from './types'

export type Lengan = 'Pendek' | 'Panjang'
export type TipePemesan = 'Pengurus Himpunan' | 'Umum'

type ProdukHarga = Pick<
  Merchandise,
  'harga' | 'harga_po' | 'harga_po_panjang' | 'harga_po_umum' | 'harga_po_umum_panjang' | 'harga_hari_h_panjang'
>

export function opsiWarna(warna: string | null | undefined): string[] {
  return [...new Set((warna ?? '').split(',').map((item) => item.trim()).filter(Boolean))]
}

export function opsiLengan(produk: ProdukHarga, mode: 'po' | 'hari_h', tipe?: TipePemesan): Lengan[] {
  const list: Lengan[] = []

  if (mode === 'hari_h') {
    if (Number(produk.harga ?? 0) > 0) list.push('Pendek')
    if (Number(produk.harga_hari_h_panjang ?? 0) > 0) list.push('Panjang')
    return list
  }

  const pengurusPendek = Number(produk.harga_po ?? 0) > 0
  const pengurusPanjang = Number(produk.harga_po_panjang ?? 0) > 0
  const umumPendek = Number(produk.harga_po_umum ?? 0) > 0 || pengurusPendek
  const umumPanjang = Number(produk.harga_po_umum_panjang ?? 0) > 0 || pengurusPanjang
  const pendek = tipe === 'Pengurus Himpunan'
    ? pengurusPendek
    : tipe === 'Umum'
      ? umumPendek
      : pengurusPendek || umumPendek
  const panjang = tipe === 'Pengurus Himpunan'
    ? pengurusPanjang
    : tipe === 'Umum'
      ? umumPanjang
      : pengurusPanjang || umumPanjang

  if (pendek) list.push('Pendek')
  if (panjang) list.push('Panjang')
  return list
}

export function hargaUntuk(
  produk: ProdukHarga,
  tipe: TipePemesan,
  lengan: Lengan,
  mode: 'po' | 'hari_h',
): number {
  if (mode === 'hari_h') {
    return Number(lengan === 'Panjang' ? produk.harga_hari_h_panjang : produk.harga) || 0
  }

  const pendek = Number(produk.harga_po) || 0
  const panjang = Number(produk.harga_po_panjang) || 0
  if (tipe === 'Pengurus Himpunan') {
    return lengan === 'Panjang' ? panjang : pendek
  }

  const umumPendek = Number(produk.harga_po_umum) || pendek
  const umumPanjang = Number(produk.harga_po_umum_panjang) || panjang
  return lengan === 'Panjang' ? umumPanjang : umumPendek
}

export function hargaMulai(produk: ProdukHarga, tipe: TipePemesan, mode: 'po' | 'hari_h'): number {
  const prices = opsiLengan(produk, mode)
    .map((lengan) => hargaUntuk(produk, tipe, lengan, mode))
    .filter((harga) => harga > 0)
  return prices.length > 0 ? Math.min(...prices) : 0
}
