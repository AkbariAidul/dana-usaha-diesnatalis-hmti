import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const kategori = [
  { kode: "KT-01", nama: "Tempat aja", harga: "Rp150.000", include: [] },
  { kode: "KT-02", nama: "Tempat + Tenda + Meja + Kursi (Fullset)", harga: "Rp450.000", include: ["Tenda", "Meja", "Kursi"] },
  { kode: "KT-03", nama: "Meja/Kursi/Tenda saja (Add-On)", harga: "Rp100.000", include: ["Meja/Kursi/Tenda"] },
];

const periode = [
  { nama: "Early Bird", mulai: "16 November", selesai: "28 November", ket: "Harga termurah" },
  { nama: "Reguler", mulai: "29 November", selesai: "12 Desember", ket: "Harga normal" },
  { nama: "Last Minute", mulai: "13 Desember", selesai: "19 Desember", ket: "Harga mendekati Hari H" },
];

const faktor = [
  { label: "Asal UMKM", items: [{ nilai: "Internal Kampus", mult: "x0.90" }, { nilai: "Eksternal", mult: "x1.00" }] },
  { label: "Lokasi Stand", items: [{ nilai: "Reguler", mult: "x1.00" }, { nilai: "Strategis 1", mult: "x1.10" }, { nilai: "Strategis 2", mult: "x1.15" }] },
];

export default function TenantInfo() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-xl font-bold">Info Open Tenant</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Kategori Sewa</h2>
          <p className="text-sm text-gray-500 mb-4">Listrik & Trashbag sudah INCLUDE untuk semua kategori</p>
          <div className="space-y-3">
            {kategori.map((k) => (
              <div key={k.kode} className="border rounded-lg p-4">
                <div className="flex justify-between">
                  <div>
                    <span className="font-mono text-sm text-indigo-600">{k.kode}</span>
                    <p className="font-medium">{k.nama}</p>
                  </div>
                  <span className="font-semibold">{k.harga}</span>
                </div>
                {k.include.length > 0 && (
                  <p className="text-sm text-gray-500 mt-1">Termasuk: {k.include.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Periode Pendaftaran</h2>
          <div className="grid gap-3">
            {periode.map((p) => (
              <div key={p.nama} className="flex justify-between items-center border-b pb-3 last:border-0">
                <div>
                  <p className="font-medium">{p.nama}</p>
                  <p className="text-sm text-gray-500">{p.mulai} - {p.selesai}</p>
                </div>
                <span className="text-sm text-gray-600">{p.ket}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Faktor Penyesuaian Harga</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {faktor.map((f) => (
              <div key={f.label}>
                <p className="font-medium mb-2">{f.label}</p>
                <div className="space-y-1">
                  {f.items.map((item) => (
                    <div key={item.nilai} className="flex justify-between text-sm">
                      <span>{item.nilai}</span>
                      <span className="font-mono">{item.mult}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-indigo-50 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-3">Syarat & Ketentuan</h2>
          <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
            <li>DP 50% wajib dibayar untuk mengunci slot</li>
            <li>Cicilan dimulai H+1 setelah DP hingga Hari H</li>
            <li>Minimal cicilan per hari ditampilkan otomatis di dashboard</li>
            <li>Pembayaran bisa dilakukan secara lump sum (sekalian)</li>
            <li>Batas pelunasan adalah H-1 sebelum acara</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
