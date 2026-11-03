import { Image as ImageIcon } from "lucide-react";
import { PublicNavbar } from "@/components/public-navbar";
import { getMerchandise } from "@/lib/queries";
import { formatRupiah } from "@/lib/utils";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

export default async function MerchandisePage() {
  const items = (await getMerchandise(true)).filter((item) => Number(item.harga) > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <AutoRefresh />
      <PublicNavbar
        title="Merchandise"
        maxWidth="max-w-4xl"
        crumbs={[
          { label: "Beranda", href: "/" },
          { label: "Merchandise" },
        ]}
      />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Belum ada merchandise tersedia.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {item.gambar_url ? (
                    <img src={item.gambar_url} alt={item.nama} className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="w-16 h-16 text-gray-300" />
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg">{item.nama}</h3>
                  {item.deskripsi && (
                    <p className="text-sm text-gray-500 mt-1">{item.deskripsi}</p>
                  )}
                  <div className="flex justify-between items-center mt-4">
                    <span className="font-bold text-xl text-primary-600">{formatRupiah(item.harga)}</span>
                    <span className={`text-sm px-2 py-1 rounded-full ${
                      item.stok_unlimited || item.stok > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {item.stok_unlimited ? 'Stok: Tak terbatas' : item.stok > 0 ? `Stok: ${item.stok}` : 'Habis'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
