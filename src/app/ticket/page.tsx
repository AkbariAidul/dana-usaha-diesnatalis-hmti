import Link from "next/link";
import { ArrowLeft, TicketIcon } from "lucide-react";
import { getTicket } from "@/lib/queries";
import { formatRupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TicketPage() {
  const tickets = await getTicket(false); // all, sorted by harga

  return (
    <div className="min-h-screen bg-gray-50">
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
              const pct = t.kuota > 0 ? Math.min(100, Math.round((t.terjual / t.kuota) * 100)) : 0
              const habis = t.terjual >= t.kuota
              return (
                <div
                  key={t.id}
                  className={`bg-white rounded-xl shadow p-6 transition-shadow hover:shadow-md ${!t.aktif || habis ? 'opacity-60' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{t.nama}</h3>
                        {t.aktif && !habis && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Tersedia</span>
                        )}
                        {habis && (
                          <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Habis</span>
                        )}
                        {!t.aktif && !habis && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Belum Dibuka</span>
                        )}
                      </div>
                      {(t.mulai || t.selesai) && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {t.mulai && t.selesai
                            ? `${new Date(t.mulai).toLocaleDateString('id-ID')} – ${new Date(t.selesai).toLocaleDateString('id-ID')}`
                            : t.mulai
                            ? `Mulai ${new Date(t.mulai).toLocaleDateString('id-ID')}`
                            : `Sampai ${new Date(t.selesai!).toLocaleDateString('id-ID')}`}
                        </p>
                      )}
                    </div>
                    <span className="font-bold text-xl text-indigo-600">{formatRupiah(t.harga)}</span>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{t.terjual} terjual dari {t.kuota} kuota</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${habis ? 'bg-red-400' : 'bg-indigo-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  );
}
