import { NextResponse } from 'next/server'
import { getMerchModalItem, upsertMerchModalItem, deleteMerchModalItem, createAuditLog } from '@/lib/queries'

export async function GET() {
  try {
    const data = await getMerchModalItem()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!String(body.nama ?? '').trim()) throw new Error('Nama item wajib diisi')

    // Dukung payload lama yang hanya mengirim `harga`
    const legacyHarga = Number(body.harga ?? 0)
    const hargaPengurusPendek = Number(body.harga_pengurus_pendek ?? legacyHarga)
    const hargaPengurusPanjang = Number(body.harga_pengurus_panjang ?? legacyHarga)
    const hargaUmumPendek = Number(body.harga_umum_pendek ?? legacyHarga)
    const hargaUmumPanjang = Number(body.harga_umum_panjang ?? legacyHarga)

    if ([hargaPengurusPendek, hargaPengurusPanjang, hargaUmumPendek, hargaUmumPanjang].some((v) => !Number.isFinite(v) || v < 0)) {
      throw new Error('Harga modal tidak valid')
    }

    const data = await upsertMerchModalItem({
      ...body,
      nama: String(body.nama).trim(),
      hargaPengurusPendek,
      hargaPengurusPanjang,
      hargaUmumPendek,
      hargaUmumPanjang,
    })
    await createAuditLog({
      aksi: body.id ? 'UPDATE_MERCH_MODAL' : 'CREATE_MERCH_MODAL',
      target_type: 'merch_modal_item',
      target_id: data.id,
      data_baru: data,
    })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    await deleteMerchModalItem(id)
    await createAuditLog({ aksi: 'DELETE_MERCH_MODAL', target_type: 'merch_modal_item', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
