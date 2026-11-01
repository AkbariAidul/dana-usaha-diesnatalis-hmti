import Link from "next/link";
import { ArrowLeft, TicketIcon } from "lucide-react";
import { getTicketKatalog } from "@/lib/queries";
import { formatRupiah } from "@/lib/utils";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";

export default async function TicketPage() {
  const tickets = await getTicketKatalog();

  return (
    <div className="min-h-screen bg-gray-50">
      <AutoRefresh />
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold">Ticket</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {tickets.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <TicketIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>Belum ada informasi ticket.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t) => {
              const habis = t.sisa === 0;
              const status = t.buka
                ? t.is_hari_h
                  ? "Hari H"
                  : "Dibuka"
                : habis
                ? "Habis"
                : t.aktif
                ? "Ditutup"
                : "Belum Dibuka";
              const terpakai = t.kuota > 0 ? t.kuota - (t.sisa ?? 0) : 0;
              const pct = t.kuota > 0 ? Math.min(100, Math.round((terpakai / t.kuota) * 100)) : 0;
              return (
                <div
                  key={t.id}
                  className={`bg-white rounded-xl shadow p-6 transition-shadow hover:shadow-md ${!t.buka ? "opacity-60" : ""}`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-lg">{t.nama}</h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            t.buka
                              ? t.is_hari_h
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {status}
                        </span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {t.jumlah_orang} orang
                        </span>
                      </div>
                      {t.deskripsi && <p className="text-sm text-gray-500 mt-1">{t.deskripsi}</p>}
                      {t.periode_aktif && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          Periode {t.periode_aktif.nama || "aktif"}:{" "}
                          {new Date(t.periode_aktif.tanggal_mulai).toLocaleDateString("id-ID")} -{" "}
                          {new Date(t.periode_aktif.tanggal_selesai).toLocaleDateString("id-ID")}
                        </p>
                      )}
                      {t.is_hari_h && t.selesai_jual && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          Penjualan sampai {new Date(t.selesai_jual).toLocaleString("id-ID")}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-xl text-indigo-600">{formatRupiah(t.harga_aktif)}</span>
                      {t.periode_aktif && Number(t.periode_aktif.harga) !== Number(t.harga) && (
                        <p className="text-xs text-gray-400 line-through">{formatRupiah(t.harga)}</p>
                      )}
                    </div>
                  </div>

                  {t.is_hari_h && t.kuota > 0 && (
                    <div className="mt-4">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{terpakai} terjual dari {t.kuota} tiket</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${habis ? "bg-red-400" : "bg-orange-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    {t.buka ? (
                      <Link
                        href="/beli-tiket"
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        Beli Tiket
                      </Link>
                    ) : (
                      <span className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-500">
                        Tidak tersedia
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
