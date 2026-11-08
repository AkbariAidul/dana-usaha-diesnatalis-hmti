import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'
import { getSessionUser } from '@/lib/session-server'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { compressToWebp } from '@/lib/image-compress'

const BUCKET = 'bukti'
const MAX_SIZE = 5 * 1024 * 1024

// Magic-byte detection for all common image formats
function detectedMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png'
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  // GIF
  if (bytes.length >= 3 && bytes.toString('ascii', 0, 3) === 'GIF') return 'image/gif'
  // BMP
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp'
  // SVG (text-based, detect header)
  if (bytes.length >= 50 && bytes.toString('utf8', 0, 50).includes('<svg')) return 'image/svg+xml'
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

    // Read raw bytes first (cast avoids ArrayBufferLike mismatch)
    const bytes = Buffer.from(await file.arrayBuffer()) as unknown as Buffer
    if (bytes.length > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 5MB' }, { status: 400 })
    }

    const detected = detectedMime(bytes)
    let uploadBytes = bytes
    let contentType = detected ?? file.type.toLowerCase()
    let ext = 'bin'

    if (detected && detected.startsWith('image/')) {
      // Convert & compress all images to WebP automatically
      const result = await compressToWebp(bytes, detected)
      uploadBytes = result.buffer
      contentType = result.mimeType
      ext = result.mimeType === 'image/webp' ? 'webp' : (file.name.split('.').pop()?.toLowerCase() ?? 'bin')
    } else if (!detected) {
      // Non-image, keep original format but validate size
      ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    }

    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${folder}/${safeName}`

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, uploadBytes, { contentType, cacheControl: '31536000', upsert: false })
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
