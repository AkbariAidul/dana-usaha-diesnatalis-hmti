import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'
import { getSessionUser } from '@/lib/session-server'
import { clientIp, rateLimit } from '@/lib/rate-limit'

const BUCKET = 'bukti'
const MAX_SIZE = 5 * 1024 * 1024
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function detectedMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png'
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

export async function POST(request: Request) {
  try {
    if (!rateLimit(`upload:${clientIp(request.headers)}`, 20, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Terlalu banyak upload. Coba lagi nanti.' }, { status: 429 })
    }

    const form = await request.formData()
    const file = form.get('file') as File | null
    const folder = ((form.get('folder') as string) || 'bukti').replace(/[^a-zA-Z0-9_-]/g, '') || 'bukti'

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'File wajib diupload' }, { status: 400 })
    }

    const declared = file.type.toLowerCase()
    const ext = EXT[declared]
    if (!ext) {
      return NextResponse.json({ error: 'Format file harus jpg, png, atau webp' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 5MB' }, { status: 400 })
    }

    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${folder}/${safeName}`
    const bytes = Buffer.from(await file.arrayBuffer())
    if (detectedMime(bytes) !== declared) {
      return NextResponse.json({ error: 'Isi file tidak sesuai format gambar' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: declared, cacheControl: '31536000', upsert: false })
    if (error) throw error

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    const session = await getSessionUser()
    if (session) {
      await createAuditLog({ aksi: 'UPLOAD_FILE', target_type: 'storage', target_id: path, data_baru: { url: data.publicUrl }, user_name: session.name })
    }
    return NextResponse.json({ url: data.publicUrl })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
