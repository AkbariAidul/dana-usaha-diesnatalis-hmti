import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getPeriodeHarga, getHargaDasar, getKategoriSewa, getAcara } from '@/lib/queries'
import { periodeDariTanggal, type TenantAddon } from '@/lib/types'
import { getPeralatanMeta } from '@/lib/peralatan'
import { todayISO } from '@/lib/utils'
import { signRef } from '@/lib/link-token'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('pendaftaran_tenant_pub')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { pilihan: pilihanBody, ...dataBody } = body
    const tglDaftar = todayISO()
    const [periods, hargaDasar, kategori, acara] = await Promise.all([
      getPeriodeHarga(),
      getHargaDasar(),
      getKategoriSewa(),
      getAcara(),
    ])
    const periode = periodeDariTanggal(tglDaftar, periods)
    if (!periode) {
      return NextResponse.json({ error: 'Tanggal daftar di luar periode open tenant' }, { status: 400 })
    }
    const jenisUsaha = 'F&B'
    const hargaDasarItem = hargaDasar.find(
      (h) => h.kategori_sewa_id === body.kategori_sewa_id && h.jenis_usaha === jenisUsaha && h.periode === periode
    )
    if (!hargaDasarItem) {
      return NextResponse.json({ error: 'Harga untuk kategori dan periode ini belum diatur' }, { status: 400 })
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
    const pilihanReq = Array.isArray(pilihanBody)
      ? Array.from(new Set(pilihanBody.map(String))).slice(0, 20)
      : []
    if (pilihanReq.length > 0) {
      const { data: items } = await supabaseAdmin
        .from('kategori_pilihan')
        .select('id, nama, harga, kategori_sewa_id')
        .in('id', pilihanReq)
      const pilihanAddon = (items ?? [])
        .filter((item: { kategori_sewa_id: string }) => item.kategori_sewa_id === body.kategori_sewa_id)
        .map((item: { id: string; nama: string; harga: number }) => {
          const hargaSatuan = Number(item.harga)
          return {
            id: item.id,
            nama: item.nama,
            qty: 1,
            harga_satuan: hargaSatuan,
            subtotal: hargaSatuan,
          }
        })
      addon = [...addon, ...pilihanAddon]
    }
    const addonTotal = addon.reduce((sum, a) => sum + a.subtotal, 0)
    const kategoriItem = kategori.find((k) => k.id === body.kategori_sewa_id)
    const lokasi = kategoriItem?.kode === 'KT-02' ? 'Strategis 1' : 'Reguler'
    const harga = Math.round(Number(hargaDasarItem.harga)) + addonTotal

    const existing = await supabaseAdmin.from('pendaftaran_tenant_pub').select('kode_pendaftaran')
    const maxKode = (existing.data || []).reduce((m: number, t: { kode_pendaftaran: string }) => {
      const n = Number(/(\d+)$/.exec(t.kode_pendaftaran)?.[1] ?? 0)
      return n > m ? n : m
    }, 0)
    const kode = `TP-${String(maxKode + 1).padStart(4, '0')}`
    const payload = {
      ...dataBody,
      jenis_usaha: jenisUsaha,
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
    const { data, error } = await supabaseAdmin.from('pendaftaran_tenant_pub').insert(payload).select().single()
    if (error) throw error
    return NextResponse.json({ ...data, t: signRef('tenant', data.kode_pendaftaran) }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
