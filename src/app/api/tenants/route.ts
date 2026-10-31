import { NextResponse } from 'next/server'
import { getTenants, createTenant, createAuditLog, getPeriodeHarga } from '@/lib/queries'
import { periodeDariTanggal } from '@/lib/types'

export async function GET() {
  try {
    const data = await getTenants()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validasi minimal
    if (!body.nama_usaha || !body.kontak || !body.kategori_sewa_id) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    // Periode ditentukan server dari tanggal daftar (tidak bisa diakali dari form)
    const tglDaftar = body.tgl_daftar || new Date().toISOString().slice(0, 10)
    const periode = periodeDariTanggal(tglDaftar, await getPeriodeHarga())
    if (!periode) {
      return NextResponse.json({ error: 'Tanggal daftar di luar periode open tenant' }, { status: 400 })
    }

    // Auto-generate kode stand dari nomor terbesar (aman walau ada data terhapus)
    const existing = await getTenants()
    const maxKode = existing.reduce((m, t) => {
      const n = Number(/(\d+)$/.exec(t.kode_stand)?.[1] ?? 0)
      return n > m ? n : m
    }, 0)
    const kode = `KT-${String(maxKode + 1).padStart(2, '0')}`

    const tenant = await createTenant({ ...body, tgl_daftar: tglDaftar, periode_daftar: periode, kode_stand: kode })
    await createAuditLog({ aksi: 'CREATE_TENANT', target_type: 'tenants', target_id: tenant.id, data_baru: tenant })
    return NextResponse.json(tenant, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
