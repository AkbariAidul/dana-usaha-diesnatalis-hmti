import { NextResponse } from 'next/server'
import { getMerchandise, upsertMerchandise, deleteMerchandise, createAuditLog } from '@/lib/queries'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const data = await getMerchandise()
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    let payload: Record<string, unknown> = {}

    if (contentType.includes('multipart/form-data')) {
      const fd = await request.formData()
      const gambar = fd.get('gambar') as File | null
      let gambarUrl: string | null = null

      if (gambar && gambar.size > 0) {
        const ext = gambar.name.split('.').pop()
        const path = `merchandise/${Date.now()}.${ext}`
        await supabaseAdmin.storage.from('merchandise-images').upload(path, gambar, { contentType: gambar.type })
        const { data: urlData } = supabaseAdmin.storage.from('merchandise-images').getPublicUrl(path)
        gambarUrl = urlData.publicUrl
      }

      const id = fd.get('id') as string | null
      payload = {
        ...(id ? { id } : {}),
        nama: fd.get('nama') as string,
        deskripsi: (fd.get('deskripsi') as string) || null,
        harga: Number(fd.get('harga')),
        harga_po: fd.get('harga_po') ? Number(fd.get('harga_po')) : null,
        po_mulai: (fd.get('po_mulai') as string) || null,
        po_selesai: (fd.get('po_selesai') as string) || null,
        po_unlimited: fd.get('po_unlimited') === 'true',
        po_stok: Number(fd.get('po_stok') || 0),
        stok: Number(fd.get('stok') || 0),
        stok_unlimited: fd.get('stok_unlimited') === 'true',
        aktif: fd.get('aktif') === 'true',
        ...(gambarUrl ? { gambar_url: gambarUrl } : {}),
      }
    } else {
      payload = await request.json()
    }

    const data = await upsertMerchandise(payload)
    await createAuditLog({
      aksi: payload.id ? 'UPDATE_MERCHANDISE' : 'CREATE_MERCHANDISE',
      target_type: 'merchandise',
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
    await deleteMerchandise(id)
    await createAuditLog({ aksi: 'DELETE_MERCHANDISE', target_type: 'merchandise', target_id: id })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
