import { NextResponse } from 'next/server'
import { compressAndConvertToWebp } from '@/lib/image'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'bukti'

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const folder = ((form.get('folder') as string) || 'bukti').replace(/[^a-zA-Z0-9_-]/g, '') || 'bukti'

    if (!file) {
      return NextResponse.json({ error: 'File wajib diupload' }, { status: 400 })
    }

    const bytes = await compressAndConvertToWebp(file)
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`
    const path = `${folder}/${safeName}`

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(bytes), { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
    if (error) throw error

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
