import sharp from 'sharp'

const MAX_DIM = 1920
const WEBP_QUALITY = 82

/**
 * Compresses and converts any image buffer to WebP at ~82% quality.
 * Returns { buffer, mimeType }.
 */
export async function compressToWebp(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  const { width = 0, height = 0 } = await sharp(buffer).metadata()
  const resized =
    width > MAX_DIM || height > MAX_DIM
      ? sharp(buffer).resize({ width: Math.min(width, MAX_DIM), height: Math.min(height, MAX_DIM), fit: 'inside' })
      : sharp(buffer)
  const { data } = await resized.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true })
  return { buffer: Buffer.from(data), mimeType: 'image/webp' }
}
