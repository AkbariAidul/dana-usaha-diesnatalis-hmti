import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { compressAndConvertToWebp } from '@/lib/image'

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    const folder = (form.get('folder') as string) || 'bukti'

    if (!file) {
      return NextResponse.json({ error: 'File wajib diupload' }, { status: 400 })
    }

    const bytes = await compressAndConvertToWebp(file, file.name)
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`
    const dir = join(process.cwd(), 'public', 'uploads', folder)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, safeName), Buffer.from(bytes))
    return NextResponse.json({ url: `/uploads/${folder}/${safeName}` })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
