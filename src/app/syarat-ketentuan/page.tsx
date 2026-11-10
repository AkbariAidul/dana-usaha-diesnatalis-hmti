import type { Metadata } from 'next'
import { PublicBreadcrumb, PublicNavbar } from '@/components/public-navbar'

export const metadata: Metadata = {
  title: 'Syarat & Ketentuan',
  description: 'Syarat dan ketentuan pembelian tiket, pre-order merchandise, paket combo, dan pendaftaran tenant In4Days XI.',
  alternates: { canonical: '/syarat-ketentuan' },
}

export default function SyaratKetentuanPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <PublicNavbar title="Syarat & Ketentuan" />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PublicBreadcrumb className="mb-5" items={[{ label: 'Beranda', href: '/' }, { label: 'Syarat & Ketentuan' }]} />
        <article className="space-y-6 rounded-2xl border border-slate-200/70 bg-white p-6 text-sm leading-relaxed text-slate-600 shadow-sm sm:p-8">
          <section>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Syarat & Ketentuan</h1>
            <p className="mt-2 text-xs text-slate-400">Terakhir diperbarui: 10 November 2026</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">1. Ketentuan Umum</h2>
            <p>Dengan melakukan pemesanan atau pendaftaran melalui situs ini, Anda dianggap telah membaca dan menyetujui syarat dan ketentuan yang berlaku.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">2. Tiket Acara</h2>
            <p>Tiket dinyatakan sah setelah pembayaran diverifikasi oleh panitia. QR tiket hanya dapat digunakan satu kali dan tidak dapat dipindahtangankan tanpa persetujuan panitia. Tiket yang telah dibeli tidak dapat dikembalikan, kecuali acara dibatalkan oleh penyelenggara.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">3. Pre-Order Merchandise</h2>
            <p>Pesanan merchandise diproduksi berdasarkan pesanan yang masuk. Pastikan ukuran, warna, dan varian sudah benar sebelum membayar. Kesalahan pemilihan varian menjadi tanggung jawab pemesan.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">4. Paket Combo</h2>
            <p>Paket combo merupakan gabungan tiket dan merchandise dengan harga khusus. Ketentuan tiket dan merchandise berlaku sesuai bagian masing-masing.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">5. Pendaftaran Tenant</h2>
            <p>Pendaftaran tenant dinyatakan sah setelah data diverifikasi dan pembayaran sesuai ketentuan diterima. Slot tenant terbatas dan diberikan berdasarkan urutan pendaftaran yang sah. Panitia berhak menolak pendaftaran yang tidak memenuhi ketentuan.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">6. Pembayaran</h2>
            <p>Pembayaran dilakukan melalui metode yang tersedia pada situs. Bukti pembayaran wajib diunggah agar pesanan dapat diverifikasi. Panitia tidak bertanggung jawab atas keterlambatan akibat bukti pembayaran yang tidak valid.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">7. Batasan Tanggung Jawab</h2>
            <p>Panitia berupaya menjaga layanan tetap tersedia, namun tidak menjamin situs bebas dari gangguan teknis. Panitia tidak bertanggung jawab atas kerugian tidak langsung yang timbul dari penggunaan situs.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-slate-900">8. Perubahan Ketentuan</h2>
            <p>Panitia dapat mengubah syarat dan ketentuan ini sewaktu-waktu. Versi terbaru akan ditampilkan pada halaman ini.</p>
          </section>
        </article>
      </main>
    </div>
  )
}
