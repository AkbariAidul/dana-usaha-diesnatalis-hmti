import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dana Usaha HMTI',
    short_name: 'Danus HMTI',
    description: 'Pendaftaran tenant, tiket, dan merchandise Dana Usaha HMTI In4Days XI.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#16a34a',
    icons: [{ src: '/favicon.png', sizes: 'any', type: 'image/png' }],
  }
}
