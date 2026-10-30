import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const MAX_SIZE_KB = 2048
const QUALITY = 80

export async function compressAndConvertToWebp(file: File | Blob, name: string): Promise<Uint8Array> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const compressed = await sharp(buffer)
    .webp({ quality: QUALITY, effort: 6 })
    .toBuffer()

  if (compressed.byteLength > MAX_SIZE_KB * 1024) {
    const lower = await sharp(buffer)
      .webp({ quality: 70, effort: 6 })
      .resize({ width: 1600, withoutEnlargement: true })
      .toBuffer()
    return lower
  }

  if (compressed.byteLength > MAX_SIZE_KB * 1024) {
    const smaller = await sharp(buffer)
      .webp({ quality: 60, effort: 6 })
      .resize({ width: 1280, withoutEnlargement: true })
      .toBuffer()
    return smaller
  }

  return compressed
}

export async function saveWebpToPublic(file: File, folder: string): Promise<string> {
  const extName = 'webp'
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${extName}`
  const dir = join(process.cwd(), 'public', 'uploads', folder)
  await mkdir(dir, { recursive: true })
  const bytes = await compressAndConvertToWebp(file, safeName)
  await writeFile(join(dir, safeName), bytes)
  return `/uploads/${folder}/${safeName}`
}
