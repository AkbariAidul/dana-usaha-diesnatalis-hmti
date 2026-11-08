const MAX_DIM = 1920
const WEBP_QUALITY = 82

/**
 * Compresses and converts any image buffer to WebP at ~82% quality.
 * Returns { buffer, mimeType }.
 */
export async function compressToWebp(
  buffer: Buffer,
  fallbackMime = 'image/jpeg',
): Promise<{ buffer: Buffer; mimeType: string }> {
  // ponytail: sharp di-load lazy. Import statis di top-level membuat modul ini
  // (dan semua route yang meng-import queries) crash saat load di Vercel karena
  // binary native sharp gagal di-trace Turbopack.
  try {
    const { default: sharp } = await import('sharp')
    const { width = 0, height = 0 } = await sharp(buffer).metadata()
    const resized =
      width > MAX_DIM || height > MAX_DIM
        ? sharp(buffer).resize({ width: Math.min(width, MAX_DIM), height: Math.min(height, MAX_DIM), fit: 'inside' })
        : sharp(buffer)
    const { data } = await resized.webp({ quality: WEBP_QUALITY }).toBuffer({ resolveWithObject: true })
    return { buffer: Buffer.from(data), mimeType: 'image/webp' }
  } catch {
    // ponytail: kalau binary sharp absen di runtime serverless, simpan file asli
    // daripada menggagalkan semua upload. Cek outputFileTracingIncludes di next.config.
    return { buffer, mimeType: fallbackMime }
  }
}
