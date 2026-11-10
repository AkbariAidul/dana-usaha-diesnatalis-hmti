import type { MetadataRoute } from 'next'

const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '',
    '/beli-tiket',
    '/daftar-tenant',
    '/merchandise',
    '/paket',
    '/lacak',
    '/kebijakan-privasi',
    '/syarat-ketentuan',
  ]
  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: path === '' ? 1 : 0.8,
  }))
}
