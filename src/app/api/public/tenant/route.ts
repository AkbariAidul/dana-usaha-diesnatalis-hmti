import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getPeriodeHarga, getHargaDasar, getKategoriSewa, getAcara, getKategoriBundleDiscount } from '@/lib/queries'
import { periodeDariTanggal, type TenantAddon } from '@/lib/types'
import { getPeralatanMeta } from '@/lib/peralatan'
import { todayISO } from '@/lib/utils'
import { signRef } from '@/lib/link-token'
import { turnstileFailure, verifyTurnstile } from '@/lib/turnstile'

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return String(err)
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('pendaftaran_tenant_pub')
      .select('*')
      .neq('status', 'dp_diterima')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const pilihanBody = body.pilihan
    const dataBody: Record<string, unknown> = {}
    for (const key of ['nama_usaha', 'kontak', 'email', 'alamat', 'deskripsi_usaha', 'kategori_sewa_id', 'jenis_usaha']) {
      if (body[key] !== undefined) dataBody[key] = body[key]
    }
    const tglDaftar = todayISO()
    const [periods, hargaDasar, kategori, acara, bundles] = await Promise.all([
      getPeriodeHarga(),
      getHargaDasar(),
      getKategoriSewa(),
      getAcara(),
      getKategoriBundleDiscount(),
    ])
    const periode = periodeDariTanggal(tglDaftar, periods)
    if (!periode) {
      return NextResponse.json({ error: 'Tanggal daftar di luar periode open tenant' }, { status: 400 })
    }
    const qtyRaw = body.jenis_usaha_qty as { fnb?: unknown; nonFnb?: unknown } | undefined
    let qtyFnb: number
    let qtyNonFnb: number
    if (qtyRaw && (qtyRaw.fnb !== undefined || qtyRaw.nonFnb !== undefined)) {
      qtyFnb = Math.max(0, Math.min(99, Number(qtyRaw.fnb) || 0))
      qtyNonFnb = Math.max(0, Math.min(99, Number(qtyRaw.nonFnb) || 0))
    } else {
      // Kompatibilitas klien lama: satu jenis usaha + jumlah tenant.
      const jumlah = Math.max(1, Math.min(99, Number(body.jumlah_tenant) || 1))
      if (body.jenis_usaha === 'Non-F&B') {
        qtyFnb = 0
        qtyNonFnb = jumlah
      } else {
        qtyFnb = jumlah
        qtyNonFnb = 0
      }
    }
    const jumlahTenant = qtyFnb + qtyNonFnb
    if (jumlahTenant < 1) {
      return NextResponse.json({ error: 'Jumlah tenant minimal 1' }, { status: 400 })
    }
    const hargaUntuk = (jenis: 'F&B' | 'Non-F&B') =>
      hargaDasar.find((h) => h.kategori_sewa_id === body.kategori_sewa_id && h.jenis_usaha === jenis && h.periode === periode)
    const hargaFnbItem = qtyFnb > 0 ? hargaUntuk('F&B') : null
    const hargaNonFnbItem = qtyNonFnb > 0 ? hargaUntuk('Non-F&B') : null
    if (qtyFnb > 0 && !hargaFnbItem) {
      return NextResponse.json({ error: 'Harga F&B untuk kategori dan periode ini belum diatur' }, { status: 400 })
    }
    if (qtyNonFnb > 0 && !hargaNonFnbItem) {
      return NextResponse.json({ error: 'Harga Non-F&B untuk kategori dan periode ini belum diatur' }, { status: 400 })
    }
    const jenisUsaha = qtyNonFnb > qtyFnb ? 'Non-F&B' : 'F&B'
    const kategoriItem = kategori.find((k) => k.id === body.kategori_sewa_id)
    if (!kategoriItem) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 400 })
    }
    if (kategoriItem.aktif === false) {
      return NextResponse.json({ error: 'Paket tenant ini sedang tidak aktif' }, { status: 400 })
    }
    const slot = Number(kategoriItem.slot_tenant) || 0
    if (slot > 0) {
      const { data: terpakai } = await supabaseAdmin
        .from('pendaftaran_tenant_pub')
        .select('jumlah_tenant')
        .eq('kategori_sewa_id', body.kategori_sewa_id)
        .not('status', 'in', '("ditolak","batal")')
      const used = (terpakai ?? []).reduce((sum: number, row: { jumlah_tenant?: number }) => sum + Number(row.jumlah_tenant ?? 1), 0)
      if (used + jumlahTenant > slot) {
        return NextResponse.json({ error: `Slot kategori tersisa ${Math.max(0, slot - used)}` }, { status: 400 })
      }
    }

    const addonReq = Array.isArray(body.addon) ? body.addon.slice(0, 20) : []
    let addon: TenantAddon[] = []
    if (addonReq.length > 0) {
      const ids = addonReq.map((a: { id?: string }) => a.id).filter(Boolean)
      const [{ data: items }, meta] = await Promise.all([
        supabaseAdmin.from('peralatan').select('id, nama').in('id', ids),
        getPeralatanMeta(),
      ])
      const byId = new Map((items ?? []).map((item: { id: string; nama: string }) => [item.id, item]))
      addon = addonReq
        .map((a: { id?: string; qty?: number }) => {
          const item = a.id ? byId.get(a.id) : undefined
          const hargaSatuan = Number(meta[a.id ?? '']?.harga_sewa ?? 0)
          const qty = Math.max(1, Math.min(99, Number(a.qty) || 1))
          if (!item || hargaSatuan <= 0) return null
          return {
            id: item.id,
            nama: item.nama,
            qty,
            harga_satuan: hargaSatuan,
            subtotal: hargaSatuan * qty,
          }
        })
        .filter((a: TenantAddon | null): a is TenantAddon => a !== null)
    }
    const addonLainTotal = addon.reduce((sum, a) => sum + a.subtotal, 0)
    const pilihanReq = Array.isArray(pilihanBody)
      ? pilihanBody
          .map((p: { id?: string; qty?: number }) => ({ id: String(p.id ?? ''), qty: Math.max(1, Math.min(99, Number(p.qty) || 1)) }))
          .filter((p: { id: string }) => p.id)
          .slice(0, 20)
      : []
    let pilihanTotal = 0
    if (pilihanReq.length > 0) {
      const ids = pilihanReq.map((p: { id: string }) => p.id)
      const { data: items } = await supabaseAdmin
        .from('kategori_pilihan')
        .select('id, nama, harga, kategori_sewa_id')
        .in('id', ids)
      const byId = new Map((items ?? []).map((item: { id: string; nama: string; harga: number; kategori_sewa_id: string }) => [item.id, item]))
      const pilihanAddon = pilihanReq
        .map((req: { id: string; qty: number }) => {
          const item = byId.get(req.id)
          if (!item || item.kategori_sewa_id !== body.kategori_sewa_id) return null
          if (/^tempat\b/i.test(item.nama.trim())) return null
          const hargaSatuan = Number(item.harga)
          const subtotal = hargaSatuan * req.qty
          pilihanTotal += subtotal
          return {
            id: item.id,
            nama: item.nama,
            qty: req.qty,
            harga_satuan: hargaSatuan,
            subtotal,
          }
        })
        .filter((a: TenantAddon | null): a is TenantAddon => a !== null)
      addon = [...addon, ...pilihanAddon]
    }
    const lokasi = kategoriItem.kode === 'KT-02' ? 'Strategis 1' : 'Reguler'
    const subtotalPaket =
      Number(hargaFnbItem?.harga ?? 0) * qtyFnb +
      Number(hargaNonFnbItem?.harga ?? 0) * qtyNonFnb +
      pilihanTotal
    const bundle = [...bundles]
      .filter((b) => b.kategori_sewa_id === body.kategori_sewa_id && jumlahTenant >= Number(b.jumlah_min))
      .sort((a, b) => Number(b.jumlah_min) - Number(a.jumlah_min))[0]
    const diskon = bundle
      ? Math.min(subtotalPaket, Number(bundle.diskon_nominal) + subtotalPaket * (Number(bundle.diskon_persen) / 100))
      : 0
    const harga = Math.max(0, Math.round(subtotalPaket - diskon) + addonLainTotal)

    const existing = await supabaseAdmin.from('pendaftaran_tenant_pub').select('kode_pendaftaran')
    const maxKode = (existing.data || []).reduce((m: number, t: { kode_pendaftaran: string }) => {
      const n = Number(/(\d+)$/.exec(t.kode_pendaftaran)?.[1] ?? 0)
      return n > m ? n : m
    }, 0)
    const kode = `TP-${String(maxKode + 1).padStart(4, '0')}`
    const payload = {
      ...dataBody,
      jenis_usaha: jenisUsaha,
      jenis_usaha_qty: { fnb: qtyFnb, nonFnb: qtyNonFnb },
      jumlah_tenant: jumlahTenant,
      asal: 'Internal Kampus',
      lokasi,
      addon,
      tgl_daftar: tglDaftar,
      tgl_acara: acara?.tanggal_acara ?? null,
      periode_daftar: periode,
      harga_akhir: harga,
      dp_wajib: Math.ceil(harga / 2),
      kode_pendaftaran: kode,
      status: 'menunggu_verifikasi',
      sudah_dibayar: 0,
    }
    const turnstile = await verifyTurnstile(body.turnstile_token, request.headers)
    if (!turnstile.ok) {
      const failure = turnstileFailure(turnstile.reason)
      return NextResponse.json({ error: failure.error }, { status: failure.status })
    }
    let inserted = await supabaseAdmin.from('pendaftaran_tenant_pub').insert(payload).select().single()
    if (inserted.error && String(inserted.error.message).includes('jenis_usaha_qty')) {
      // ponytail: kolom belum ada (migrasi 037 belum dijalankan). Tetap simpan pendaftaran.
      const rest = { ...payload }
      delete (rest as Record<string, unknown>).jenis_usaha_qty
      inserted = await supabaseAdmin.from('pendaftaran_tenant_pub').insert(rest).select().single()
    }
    if (inserted.error) throw inserted.error
    const data = inserted.data
    return NextResponse.json({ ...data, t: signRef('tenant', data.kode_pendaftaran) }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}
