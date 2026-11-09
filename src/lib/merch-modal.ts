type ModalItemLike = Readonly<{ harga_pengurus_pendek?: number; harga_pengurus_panjang?: number; harga_umum_pendek?: number; harga_umum_panjang?: number }>

export function modalSatuan(
  items: ModalItemLike[],
  tipe: string | null | undefined,
  lengan: string | null | undefined,
): number {
  const pengurus = tipe === 'Pengurus Himpunan'
  const panjang = lengan === 'Panjang'
  const key = pengurus
    ? panjang ? ('harga_pengurus_panjang' as const) : ('harga_pengurus_pendek' as const)
    : panjang ? ('harga_umum_panjang' as const) : ('harga_umum_pendek' as const)
  return items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0)
}
