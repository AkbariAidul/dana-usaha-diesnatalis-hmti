import type { Metadata } from 'next'
import { PublicBreadcrumb, PublicNavbar } from '@/components/public-navbar'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi',
  description: 'Kebijakan privasi Dana Usaha HMTI In4Days XI: data yang dikumpulkan, penggunaannya, dan hak Anda.',
  alternates: { canonical: '/kebijakan-privasi' },
}

export default function KebijakanPrivasiPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar title="Kebijakan Privasi" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PublicBreadcrumb className="mb-5" items={[{ label: 'Beranda', href: '/' }, { label: 'Kebijakan Privasi' }]} />
        <article className="space-y-6 rounded-2xl border border-slate-200/70 bg-white p-6 text-sm leading-relaxed text-slate-600 shadow-sm sm:p-8">
          <section>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kebijakan Privasi</h1>
            <p className="mt-2 text-xs text-slate-400">Terakhir diperbarui: 10 November 2026</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">1. Data yang Kami Kumpulkan</h2>
            <p>Kami mengumpulkan data yang Anda berikan saat melakukan pemesanan atau pendaftaran, meliputi nama, nomor kontak/WhatsApp, alamat email (opsional), data usaha untuk tenant, serta bukti pembayaran yang Anda unggah.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">2. Penggunaan Data</h2>
            <p>Data digunakan untuk memproses pesanan, memverifikasi pembayaran, menerbitkan tiket, mengirim notifikasi terkait pesanan melalui WhatsApp, serta menyusun laporan internal panitia.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">3. Penyimpanan dan Keamanan</h2>
            <p>Data disimpan pada layanan basis data dan penyimpanan berkas yang kami gunakan. Akses dibatasi hanya untuk panitia yang berwenang. Bukti pembayaran bersifat sensitif dan tidak dipublikasikan.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">4. Berbagi Data dengan Pihak Ketiga</h2>
            <p>Kami dapat menggunakan penyedia layanan pengiriman pesan WhatsApp (Fonnte) untuk mengirim notifikasi pesanan. Kami tidak menjual atau membagikan data pribadi Anda untuk tujuan pemasaran pihak ketiga.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">5. Penyimpanan Data</h2>
            <p>Data disimpan selama diperlukan untuk keperluan acara dan pertanggungjawaban panitia, kemudian dapat dihapus atau dianonimkan sesuai kebutuhan.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">6. Hak Anda</h2>
            <p>Anda dapat meminta akses, koreksi, atau penghapusan data pribadi Anda dengan menghubungi panitia melalui kontak resmi Dana Usaha HMTI.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">7. Perubahan Kebijakan</h2>
            <p>Kebijakan ini dapat diperbarui sewaktu-waktu. Perubahan akan ditampilkan pada halaman ini.</p>
          </section>
        </article>
      </main>
    </div>
  )
}
