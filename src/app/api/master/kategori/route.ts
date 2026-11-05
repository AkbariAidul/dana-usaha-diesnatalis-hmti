import { NextResponse } from 'next/server'
import { upsertKategoriSewa, createAuditLog } from '@/lib/queries'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'ID paket wajib diisi' }, { status: 400 })
    const nama = String(body.nama ?? '').trim()
    if (!nama) return NextResponse.json({ error: 'Nama paket wajib diisi' }, { status: 400 })

    const data = await upsertKategoriSewa({
      id: body.id,
      nama,
      keterangan: String(body.keterangan ?? '').trim(),
      include_listrik: Boolean(body.include_listrik),
      include_trashbag: Boolean(body.include_trashbag),
    })
    await createAuditLog({ aksi: 'UPDATE_KATEGORI_SEWA', target_type: 'kategori_sewa', target_id: data.id, data_baru: data })
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
