import { NextResponse } from 'next/server'
import { getPeriodeHarga, upsertPeriodeHarga, deletePeriodeHarga, createAuditLog } from '@/lib/queries'

function buatKode(nama: string, existing: string[]) {
  const base = nama
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'periode'
  let kode = base
  let i = 2
  while (existing.includes(kode)) kode = `${base}_${i++}`
  return kode
}

export async function GET() {
  try {
    return NextResponse.json(await getPeriodeHarga())
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.nama || !body.tanggal_mulai || !body.tanggal_selesai) {
      return NextResponse.json({ error: 'Nama dan tanggal periode wajib diisi' }, { status: 400 })
    }
    if (body.tanggal_selesai < body.tanggal_mulai) {
      return NextResponse.json({ error: 'Tanggal selesai tidak boleh sebelum tanggal mulai' }, { status: 400 })
    }

    let kode = body.kode
    if (!body.id || !kode) {
      const existing = await getPeriodeHarga()
      kode = body.id ? existing.find((p) => p.id === body.id)?.kode : buatKode(body.nama, existing.map((p) => p.kode))
    }

    const data = await upsertPeriodeHarga({
      id: body.id,
      kode,
      nama: body.nama,
      tanggal_mulai: body.tanggal_mulai,
      tanggal_selesai: body.tanggal_selesai,
    })
    await createAuditLog({
      aksi: body.id ? 'UPDATE_PERIODE_HARGA' : 'CREATE_PERIODE_HARGA',
      target_type: 'periode_harga',
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
    if (!id) return NextResponse.json({ error: 'ID periode wajib diisi' }, { status: 400 })
    await deletePeriodeHarga(id)
    await createAuditLog({ aksi: 'DELETE_PERIODE_HARGA', target_type: 'periode_harga', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
