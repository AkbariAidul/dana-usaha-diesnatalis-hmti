import { NextResponse } from 'next/server'
import { getKategoriSewa, upsertKategoriSewa, createAuditLog } from '@/lib/queries'

function nextKode(list: { kode: string }[]) {
  const max = list.reduce((m, k) => {
    const n = Number(/^KT-(\d+)$/.exec(k.kode)?.[1] ?? 0)
    return n > m ? n : m
  }, 0)
  return `KT-${String(max + 1).padStart(2, '0')}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const nama = String(body.nama ?? '').trim()
    if (!nama) return NextResponse.json({ error: 'Nama paket wajib diisi' }, { status: 400 })

    const payload = {
      nama,
      keterangan: String(body.keterangan ?? '').trim(),
      include_listrik: Boolean(body.include_listrik),
      include_trashbag: Boolean(body.include_trashbag),
    }

    if (body.id) {
      const data = await upsertKategoriSewa({ id: body.id, ...payload })
      await createAuditLog({ aksi: 'UPDATE_KATEGORI_SEWA', target_type: 'kategori_sewa', target_id: data.id, data_baru: data })
      return NextResponse.json(data)
    }

    const kode = nextKode(await getKategoriSewa())
    const data = await upsertKategoriSewa({ kode, ...payload })
    await createAuditLog({ aksi: 'CREATE_KATEGORI_SEWA', target_type: 'kategori_sewa', target_id: data.id, data_baru: data })
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
