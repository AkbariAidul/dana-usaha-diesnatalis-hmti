import { NextResponse } from 'next/server'
import { getKategoriBundleDiscount, upsertKategoriBundleDiscount, deleteKategoriBundleDiscount, createAuditLog } from '@/lib/queries'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await getKategoriBundleDiscount(searchParams.get('kategori') || undefined))
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.kategori_sewa_id) throw new Error('Paket wajib dipilih')
    if (!body.jumlah_min || Number(body.jumlah_min) < 2) throw new Error('Jumlah tenant tidak valid')
    const persen = Number(body.diskon_persen ?? 0)
    const nominal = Number(body.diskon_nominal ?? 0)
    if (persen < 0 || persen > 100) throw new Error('Diskon persen harus 0-100')
    if (nominal < 0) throw new Error('Diskon nominal tidak valid')
    if (!persen && !nominal) throw new Error('Isi diskon nominal atau persen')

    const data = await upsertKategoriBundleDiscount({
      id: body.id,
      kategori_sewa_id: body.kategori_sewa_id,
      jumlah_min: Number(body.jumlah_min),
      diskon_nominal: nominal,
      diskon_persen: persen,
      urutan: Number(body.urutan ?? 0),
    })
    await createAuditLog({
      aksi: body.id ? 'UPDATE_TENANT_BUNDLE' : 'CREATE_TENANT_BUNDLE',
      target_type: 'kategori_bundle_discount',
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
    if (!id) return NextResponse.json({ error: 'ID bundle wajib diisi' }, { status: 400 })
    await deleteKategoriBundleDiscount(id)
    await createAuditLog({ aksi: 'DELETE_TENANT_BUNDLE', target_type: 'kategori_bundle_discount', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
