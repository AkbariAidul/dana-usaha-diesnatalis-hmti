import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { createAuditLog } from '@/lib/queries'

const BUCKET = 'bukti'
const MAX_SIZE = 5 * 1024 * 1024
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const folder = ((form.get('folder') as string) || 'bukti').replace(/[^a-zA-Z0-9_-]/g, '') || 'bukti'

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'File wajib diupload' }, { status: 400 })
    }

    const ext = EXT[file.type]
    if (!ext) {
      return NextResponse.json({ error: 'Format file harus jpg, png, atau webp' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 5MB' }, { status: 400 })
    }

    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${folder}/${safeName}`
    const bytes = Buffer.from(await file.arrayBuffer())

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type, cacheControl: '31536000', upsert: false })
    if (error) throw error

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    if ((await cookies()).get('dashboard_user')?.value) {
      await createAuditLog({ aksi: 'UPLOAD_FILE', target_type: 'storage', target_id: path, data_baru: { url: data.publicUrl } })
    }
    return NextResponse.json({ url: data.publicUrl })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
