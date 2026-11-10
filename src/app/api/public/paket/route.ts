import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTicketKatalog } from '@/lib/queries'
import { getBundles, bundleSedangBuka, hitungKuotaBundleTerpakai } from '@/lib/bundle'
import { hitungTerjual } from '@/lib/merch-po'
import { hitungDiskon } from '@/lib/merch-diskon'
import { hargaUntuk, opsiLengan, opsiWarna, type Lengan } from '@/lib/merch-harga'
import { signRef } from '@/lib/link-token'
import { turnstileFailure, verifyTurnstile } from '@/lib/turnstile'
import type { BundleItem, Merchandise } from '@/lib/types'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { apiError, rpcError } from '@/lib/api-error'
import { normalizeIdempotency } from '@/lib/idempotency'

type MerchPilihan = { bundle_item_id?: string; varian_id?: string; warna?: string; lengan?: string }

export async function GET() {
  try {
    const bundles = await getBundles(true)
    const now = new Date()
    const hasil = []
    for (const b of bundles) {
      if (!bundleSedangBuka(b, now)) continue
      if (Number(b.kuota) > 0) {
        const terpakai = await hitungKuotaBundleTerpakai(b.id)
        if (terpakai >= Number(b.kuota)) continue
      }
      hasil.push(b)
    }
    return NextResponse.json(hasil)
  } catch (err: unknown) {
    return apiError(err)
  }
}

export async function POST(request: Request) {
  try {
    if (!rateLimit(`paket:${clientIp(request.headers)}`, 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' }, { status: 429 })
    }
    const body = await request.json()
    const bundleId = String(body.bundle_id ?? '')
    const nama = String(body.nama_pembeli ?? '').trim()
    const kontak = String(body.kontak ?? '').trim()
    const email = body.email ? String(body.email).trim() : null
    if (!bundleId) return NextResponse.json({ error: 'Paket wajib dipilih' }, { status: 400 })
    if (!nama || !kontak) return NextResponse.json({ error: 'Nama dan kontak wajib diisi' }, { status: 400 })

    const bundle = (await getBundles(true)).find((b) => b.id === bundleId)
    if (!bundle) return NextResponse.json({ error: 'Paket tidak ditemukan' }, { status: 400 })
    if (!bundleSedangBuka(bundle)) {
      return NextResponse.json({ error: 'Paket belum dibuka atau sudah berakhir' }, { status: 400 })
    }
    if (Number(bundle.kuota) > 0) {
      const terpakai = await hitungKuotaBundleTerpakai(bundle.id)
      if (terpakai >= Number(bundle.kuota)) {
        return NextResponse.json({ error: 'Kuota paket sudah habis' }, { status: 400 })
      }
    }

    const items = (bundle.items ?? []) as BundleItem[]
    const pilihanMerch = new Map<string, MerchPilihan>()
    if (Array.isArray(body.merch)) {
      for (const p of body.merch as MerchPilihan[]) {
        if (p.bundle_item_id) pilihanMerch.set(String(p.bundle_item_id), p)
      }
    }

    const katalog = await getTicketKatalog()
    const tiketValid: Array<{ tipe: (typeof katalog)[number]; qty: number }> = []
    const merchValid: Array<{
      produk: Merchandise
      varian: { id: string; nama: string } | null
      qty: number
      warna: string | null
      lengan: Lengan
      harga: number
      diskon: number
      subtotal: number
    }> = []

    for (const item of items) {
      if (item.tipe === 'tiket') {
        const tipe = katalog.find((t) => t.id === item.ref_id)
        if (!tipe) return NextResponse.json({ error: 'Tipe tiket pada paket tidak ditemukan' }, { status: 400 })
        if (!tipe.buka) return NextResponse.json({ error: `Tiket ${tipe.nama} sedang ditutup atau habis` }, { status: 400 })
        if (tipe.sisa !== null && item.qty > tipe.sisa) {
          return NextResponse.json({ error: `Sisa tiket ${tipe.nama} tinggal ${tipe.sisa}` }, { status: 400 })
        }
        tiketValid.push({ tipe, qty: item.qty })
        continue
      }

      const pilih = pilihanMerch.get(item.id) ?? {}
      const { data: produkRaw } = await supabaseAdmin
        .from('merchandise')
        .select('*')
        .eq('id', item.ref_id)
        .eq('aktif', true)
        .maybeSingle()
      const produk = produkRaw as Merchandise | null
      if (!produk) return NextResponse.json({ error: 'Produk pada paket tidak tersedia' }, { status: 400 })

      const now = Date.now()
      const mulai = produk.po_mulai ? new Date(produk.po_mulai).getTime() : NaN
      const selesai = produk.po_selesai ? new Date(produk.po_selesai).getTime() : NaN
      if (!Number.isFinite(mulai) || !Number.isFinite(selesai) || now < mulai || now > selesai) {
        return NextResponse.json({ error: `Pre-order ${produk.nama} belum dibuka atau sudah berakhir` }, { status: 400 })
      }

      if (!produk.po_unlimited) {
        const terjual = await hitungTerjual([produk.id])
        const sisa = Number(produk.po_stok) - (terjual.get(produk.id) ?? 0)
        if (item.qty > sisa) {
          return NextResponse.json({ error: `Slot pre-order tidak cukup untuk ${produk.nama}` }, { status: 400 })
        }
      }

      const varianTersedia = Array.isArray(produk.varian_ids) ? produk.varian_ids.map(String) : []
      const varianId = pilih.varian_id ? String(pilih.varian_id) : ''
      if (varianTersedia.length > 0 && !varianId) {
        return NextResponse.json({ error: `Pilih ukuran untuk ${produk.nama}` }, { status: 400 })
      }
      if (varianId && !varianTersedia.includes(varianId)) {
        return NextResponse.json({ error: `Ukuran tidak tersedia untuk ${produk.nama}` }, { status: 400 })
      }

      const lenganTersedia = opsiLengan(produk, 'po', 'Umum')
      if (lenganTersedia.length === 0) {
        return NextResponse.json({ error: `Pre-order ${produk.nama} belum dibuka` }, { status: 400 })
      }
      const lenganInput: Lengan =
        pilih.lengan === 'Panjang' ? 'Panjang' : pilih.lengan === 'Pendek' ? 'Pendek' : lenganTersedia[0]
      if (!lenganTersedia.includes(lenganInput)) {
        return NextResponse.json({ error: `Lengan tidak tersedia untuk ${produk.nama}` }, { status: 400 })
      }

      const warnaTersedia = opsiWarna(produk.warna)
      const warnaInput = String(pilih.warna ?? '').trim()
      if (warnaTersedia.length > 0 && !warnaInput) {
        return NextResponse.json({ error: `Pilih warna untuk ${produk.nama}` }, { status: 400 })
      }
      if (warnaTersedia.length > 0 && !warnaTersedia.includes(warnaInput)) {
        return NextResponse.json({ error: `Warna tidak tersedia untuk ${produk.nama}` }, { status: 400 })
      }
      const warna = warnaTersedia.length > 0 ? warnaInput : null

      let varian: { id: string; nama: string } | null = null
      if (varianId) {
        const { data } = await supabaseAdmin
          .from('merch_varian')
          .select('id,nama')
          .eq('id', varianId)
          .eq('aktif', true)
          .maybeSingle()
        if (!data) return NextResponse.json({ error: 'Ukuran tidak tersedia' }, { status: 400 })
        varian = data
      }

      const harga = hargaUntuk(produk, 'Umum', lenganInput, 'po')
      if (harga <= 0) return NextResponse.json({ error: `Pre-order ${produk.nama} belum dibuka` }, { status: 400 })
      const hitung = hitungDiskon(item.qty, harga, produk.diskon, 'po')
      merchValid.push({
        produk,
        varian,
        qty: item.qty,
        warna,
        lengan: lenganInput,
        harga,
        diskon: hitung.diskon,
        subtotal: hitung.total,
      })
    }

    const turnstile = await verifyTurnstile(body.turnstile_token, request.headers)
    if (!turnstile.ok) {
      const failure = turnstileFailure(turnstile.reason)
      return NextResponse.json({ error: failure.error }, { status: failure.status })
    }

    const { data, error } = await supabaseAdmin.rpc('create_bundle_order', {
      p_payload: {
        idempotency_key: normalizeIdempotency(body.idempotency_key),
        bundle_id: bundle.id,
        nama_pembeli: nama,
        kontak,
        email,
        total: Number(bundle.harga_bundle),
        tiket_items: tiketValid.map(({ tipe, qty }) => ({
          tipe_id: tipe.id,
          qty,
          harga_satuan: Number(tipe.harga_aktif),
        })),
        merch_items: merchValid.map((v) => ({
          merchandise_id: v.produk.id,
          varian_id: v.varian?.id ?? null,
          ukuran: v.varian?.nama ?? null,
          warna: v.warna,
          lengan: v.lengan,
          qty: v.qty,
          harga_satuan: v.harga,
          diskon: v.diskon,
          subtotal: v.subtotal,
        })),
        snapshot: [
          ...tiketValid.map(({ tipe, qty }) => ({
            tipe: 'tiket',
            ref_id: tipe.id,
            nama_snapshot: tipe.nama,
            qty,
            varian_id: null,
            ukuran: null,
            warna: null,
            lengan: null,
            harga_satuan: Number(tipe.harga_aktif),
            subtotal: Number(tipe.harga_aktif) * qty,
          })),
          ...merchValid.map((v) => ({
            tipe: 'merch',
            ref_id: v.produk.id,
            nama_snapshot: v.produk.nama,
            qty: v.qty,
            varian_id: v.varian?.id ?? null,
            ukuran: v.varian?.nama ?? null,
            warna: v.warna,
            lengan: v.lengan,
            harga_satuan: v.harga,
            subtotal: v.subtotal,
          })),
        ],
      },
    })
    if (error) return rpcError(error)

    const order = (data as { order: { id: string; no_pesanan: string; total: number } }).order

    return NextResponse.json(
      {
        id: order.id,
        no_pesanan: order.no_pesanan,
        total: order.total,
        items: [
          ...tiketValid.map(({ tipe, qty }) => ({ nama: tipe.nama, qty })),
          ...merchValid.map((v) => ({ nama: v.produk.nama, qty: v.qty })),
        ],
        t: signRef('bundle', order.no_pesanan),
      },
      { status: 201 },
    )
  } catch (err: unknown) {
    return apiError(err)
  }
}
