import Link from "next/link";
import { Tent, Shirt, Ticket } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-700">Dana Usaha HMTI</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Open Tenant Dies Natalis HMTI
          </h2>
          <p className="text-gray-600 text-lg">
            Sistem Pendaftaran Tenant & Informasi Merchandise
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/tenant-info" className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
            <Tent className="w-10 h-10 text-indigo-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Tenant</h3>
            <p className="text-gray-600">Info kategori sewa, harga, dan periode pendaftaran Open Tenant.</p>
          </Link>

          <Link href="/merchandise" className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
            <Shirt className="w-10 h-10 text-indigo-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Merchandise</h3>
            <p className="text-gray-600">Katalog dan harga merchandise acara Dies Natalis HMTI.</p>
          </Link>

          <Link href="/ticket" className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
            <Ticket className="w-10 h-10 text-indigo-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Ticket</h3>
            <p className="text-gray-600">Informasi penjualan ticket acara dan tahap pembeliannya.</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
