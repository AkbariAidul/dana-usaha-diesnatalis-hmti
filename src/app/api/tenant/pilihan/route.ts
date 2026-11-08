import { NextResponse } from 'next/server'
import { getKategoriPilihan, upsertKategoriPilihan, deleteKategoriPilihan, reorderKategoriPilihan, createAuditLog } from '@/lib/queries'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await getKategoriPilihan(searchParams.get('kategori') || undefined))
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.kategori_sewa_id) throw new Error('Paket wajib dipilih')
    const nama = String(body.nama ?? '').trim()
    if (!nama) throw new Error('Nama pilihan wajib diisi')
    const harga = Number(body.harga ?? 0)
    if (!Number.isFinite(harga) || harga < 0) throw new Error('Harga tidak valid')

    const daftar = await getKategoriPilihan(body.kategori_sewa_id)
    const urutan = body.urutan === undefined
      ? daftar.reduce((max, item) => Math.max(max, Number(item.urutan) || 0), -1) + 1
      : Number(body.urutan)

    const data = await upsertKategoriPilihan({
      id: body.id,
      kategori_sewa_id: body.kategori_sewa_id,
      nama,
      harga,
      urutan,
      gambar_url: typeof body.gambar_url === 'string' ? body.gambar_url.trim() || null : null,
    })
    await createAuditLog({
      aksi: body.id ? 'UPDATE_TENANT_PILIHAN' : 'CREATE_TENANT_PILIHAN',
      target_type: 'kategori_pilihan',
      target_id: data.id,
      data_baru: data,
    })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const ids: string[] = Array.isArray(body.ids) ? body.ids.map((id: unknown) => String(id)) : []
    if (!body.kategori_sewa_id || ids.length === 0) throw new Error('Data urutan tidak valid')
    await reorderKategoriPilihan(ids)
    await createAuditLog({
      aksi: 'REORDER_TENANT_PILIHAN',
      target_type: 'kategori_pilihan',
      target_id: body.kategori_sewa_id,
      data_baru: { ids },
    })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID pilihan wajib diisi' }, { status: 400 })
    await deleteKategoriPilihan(id)
    await createAuditLog({ aksi: 'DELETE_TENANT_PILIHAN', target_type: 'kategori_pilihan', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
