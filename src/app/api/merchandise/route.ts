import { NextResponse } from 'next/server'
import { getMerchandise, upsertMerchandise, deleteMerchandise, createAuditLog } from '@/lib/queries'
import { supabaseAdmin } from '@/lib/supabase'
import { compressToWebp } from '@/lib/image-compress'

// Magic-byte detection
function isImage(bytes: Buffer): boolean {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return true
  if (bytes.length >= 3 && bytes.toString('ascii', 0, 3) === 'GIF') return true
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return true
  return false
}

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
        const raw = Buffer.from(await gambar.arrayBuffer()) as unknown as Buffer
        let uploadBytes = raw
        let contentType = gambar.type.toLowerCase()
        let ext = gambar.name.split('.').pop()?.toLowerCase() ?? 'webp'
        if (isImage(raw)) {
          const result = await compressToWebp(raw)
          uploadBytes = result.buffer
          contentType = 'image/webp'
          ext = 'webp'
        }
        const path = `merchandise/${Date.now()}.${ext}`
        await supabaseAdmin.storage.from('merchandise-images').upload(path, uploadBytes, { contentType })
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
