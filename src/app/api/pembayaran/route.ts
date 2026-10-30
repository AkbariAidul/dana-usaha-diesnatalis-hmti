import { NextResponse } from 'next/server'
import { getPembayaran, createPembayaran, uploadBuktiBayar, createAuditLog } from '@/lib/queries'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenant_id') ?? undefined
    const data = await getPembayaran(tenantId)
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? ''

    let payload: Record<string, unknown>
    let file: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      file = formData.get('bukti') as File | null
      payload = {
        tenant_id: formData.get('tenant_id'),
        tanggal_bayar: formData.get('tanggal_bayar'),
        jenis: formData.get('jenis'),
        nominal: Number(formData.get('nominal')),
        metode: formData.get('metode'),
        no_ref: formData.get('no_ref') || null,
        dicatat_oleh: 'Admin',
        keterangan: formData.get('keterangan') || null,
        validated: true,
        bukti_url: null,
      }
    } else {
      payload = await request.json()
    }

    if (!payload.tenant_id || !payload.nominal || !payload.jenis) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 })
    }

    // Upload bukti jika ada
    if (file && file.size > 0) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
      if (!allowed.includes(file.type)) {
        return NextResponse.json({ error: 'Format file tidak didukung. Gunakan jpg/png/webp/pdf' }, { status: 400 })
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Ukuran file maksimal 5MB' }, { status: 400 })
      }
      payload.bukti_url = await uploadBuktiBayar(file, payload.tenant_id as string)
    }

    const pembayaran = await createPembayaran(payload as Parameters<typeof createPembayaran>[0])
    await createAuditLog({
      aksi: 'CREATE_PEMBAYARAN',
      target_type: 'pembayaran',
      target_id: pembayaran.id,
      data_baru: pembayaran,
    })

    return NextResponse.json(pembayaran, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
