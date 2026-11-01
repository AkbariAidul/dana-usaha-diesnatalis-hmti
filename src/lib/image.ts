import sharp from 'sharp'

const MAX_SIZE_KB = 2048
const QUALITY = 80

export async function compressAndConvertToWebp(file: File | Blob): Promise<Uint8Array> {
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

