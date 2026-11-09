import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { hitungDiskon } from '@/lib/merch-diskon'
import { hargaUntuk, opsiLengan, opsiWarna, type Lengan } from '@/lib/merch-harga'
import { createAuditLog } from '@/lib/queries'
import { getSessionUser } from '@/lib/session-server'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const ringkasan = params.get('ringkasan') === '1'
  const limit = Math.max(1, Math.min(1000, Number(params.get('limit')) || 50))
  try {
    if (ringkasan) {
      const [{ data: trx, error: trxError }, { data: produk, error: produkError }] = await Promise.all([
        supabaseAdmin.from('kasir_transaksi').select('qty'),
        supabaseAdmin.from('merchandise').select('stok,stok_unlimited').eq('aktif', true),
      ])
      if (trxError) throw trxError
      if (produkError) throw produkError
      const terjual = (trx ?? []).reduce((sum, item) => sum + Number(item.qty ?? 0), 0)
      const sisa = (produk ?? []).reduce(
        (sum, item) => sum + (item.stok_unlimited ? 0 : Number(item.stok ?? 0)),
        0,
      )
      return NextResponse.json({ terjual, sisa, total: terjual + sisa })
    }

    const { data, error } = await supabaseAdmin
      .from('kasir_transaksi')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    
    const transformed = (data ?? []).map(item => ({
      id: item.id,
      merchandise_id: item.merchandise_id ?? null,
      tanggal: item.created_at || new Date().toISOString(),
      produk: item.produk_nama || item.produk || '-',
      warna: item.warna || null,
      lengan: item.lengan || null,
      qty: Number(item.qty),
      total: Number(item.total),
      diskon: Number(item.diskon ?? 0),
      metode: item.metode || 'Tunai',
      dicatat_oleh: item.dicatat_oleh || 'Admin',
      bukti_url: item.bukti_url || null,
    }))
    
    return NextResponse.json(transformed)
  } catch (err: unknown) {
    console.error('Kasir error:', err)
    if (ringkasan) return NextResponse.json({ terjual: 0, sisa: 0, total: 0 }, { status: 200 })
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const kasir = await getSessionUser()
    if (!kasir) {
      return NextResponse.json({ error: 'Sesi login tidak ditemukan, silakan login ulang' }, { status: 401 })
    }

    const body = await request.json()
    const merchandiseId = String(body.merchandise_id ?? '')
    const qty = Math.max(1, Math.min(999, Number(body.qty) || 1))
    if (!merchandiseId) {
      return NextResponse.json({ error: 'Produk wajib dipilih' }, { status: 400 })
    }

    const { data: produk, error: produkError } = await supabaseAdmin
      .from('merchandise')
      .select('id,nama,harga,harga_po,harga_po_panjang,harga_po_umum,harga_po_umum_panjang,harga_hari_h_panjang,warna,stok,stok_unlimited,diskon')
      .eq('id', merchandiseId)
      .eq('aktif', true)
      .maybeSingle()
    if (produkError) throw produkError
    if (!produk) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })

    const lenganTersedia = opsiLengan(produk, 'hari_h')
    if (lenganTersedia.length === 0) {
      return NextResponse.json({ error: 'Produk ini tidak dijual pada Hari H' }, { status: 400 })
    }
    const lenganInput: Lengan = body.lengan === 'Panjang'
      ? 'Panjang'
      : body.lengan === 'Pendek'
        ? 'Pendek'
        : lenganTersedia[0]
    if (!lenganTersedia.includes(lenganInput)) {
      return NextResponse.json({ error: 'Lengan tidak tersedia' }, { status: 400 })
    }

    const warnaTersedia = opsiWarna(produk.warna)
    const warnaInput = String(body.warna ?? '').trim()
    if (warnaTersedia.length > 0 && !warnaInput) {
      return NextResponse.json({ error: 'Pilih warna produk' }, { status: 400 })
    }
    if (warnaTersedia.length > 0 && !warnaTersedia.includes(warnaInput)) {
      return NextResponse.json({ error: 'Warna tidak tersedia' }, { status: 400 })
    }
    const warna = warnaTersedia.length > 0 ? warnaInput : null
    const harga = hargaUntuk(produk, 'Umum', lenganInput, 'hari_h')
    if (harga <= 0) {
      return NextResponse.json({ error: 'Produk ini tidak dijual pada Hari H' }, { status: 400 })
    }

    const stokAwal = Number(produk.stok)
    if (!produk.stok_unlimited) {
      if (qty > stokAwal) {
        return NextResponse.json({ error: `Stok tersisa ${stokAwal}` }, { status: 400 })
      }
      const { data: updated, error } = await supabaseAdmin
        .from('merchandise')
        .update({ stok: stokAwal - qty })
        .eq('id', merchandiseId)
        .eq('stok', stokAwal)
        .select('id')
      if (error) throw error
      if (!updated?.length) {
        return NextResponse.json({ error: 'Stok berubah, coba lagi' }, { status: 409 })
      }
    }

    const hitung = hitungDiskon(qty, harga, produk.diskon, 'hari_h')
    const { data, error } = await supabaseAdmin
      .from('kasir_transaksi')
      .insert({
        merchandise_id: merchandiseId,
        produk: produk.nama,
        produk_nama: produk.nama,
        warna,
        lengan: lenganInput,
        qty,
        total: hitung.total,
        diskon: hitung.diskon,
        metode: body.metode === 'QRIS' ? 'QRIS' : 'Tunai',
        dicatat_oleh: kasir.name,
        bukti_url: typeof body.bukti_url === 'string' && body.bukti_url.trim() ? body.bukti_url.trim() : null,
      })
      .select()
      .single()

    if (error) {
      // ponytail: compensating update, not a DB transaction.
      if (!produk.stok_unlimited) {
        await supabaseAdmin.from('merchandise').update({ stok: stokAwal }).eq('id', merchandiseId)
      }
      throw error
    }
    await createAuditLog({ aksi: 'CREATE_KASIR', target_type: 'kasir_transaksi', target_id: data.id, data_baru: data })
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

async function deleteStoragePaths(paths: string[]) {
  if (paths.length === 0) return
  try {
    const { error } = await supabaseAdmin.storage.from('bukti').remove(paths as string[])
    if (error) console.error('Gagal hapus storage:', error.message)
  } catch { /* ignore */ }
}

export async function DELETE(request: Request) {
  try {
    const { ids }: { ids: string[] } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })
    }
    // Ambil data sebelum dihapus (stok + bukti)
    const { data: existing } = await supabaseAdmin
      .from('kasir_transaksi')
      .select('id, merchandise_id, qty, bukti_url')
      .in('id', ids)
    const toRestore = (existing ?? []).filter((r) => r.merchandise_id != null && Number(r.qty) > 0)
    const pathsToClean = (existing ?? [])
      .map((r) => {
        if (!r.bukti_url) return null
        try {
          const url = new URL(r.bukti_url)
          return url.pathname.split('?')[0].startsWith('/') ? url.pathname.slice(1) : null
        } catch { return null }
      })
      .filter(Boolean) as string[]

    const { error } = await supabaseAdmin.from('kasir_transaksi').delete().in('id', ids)
    if (error) throw error
    if (pathsToClean.length > 0) await deleteStoragePaths(pathsToClean)

    // Restore stok produk yang finite
    const restoredMap = new Map<string, number>()
    for (const r of toRestore) {
      const mid = String(r.merchandise_id)
      restoredMap.set(mid, (restoredMap.get(mid) ?? 0) + Number(r.qty))
    }
    for (const [mid, qty] of restoredMap.entries()) {
      const { data: produk } = await supabaseAdmin.from('merchandise').select('stok,stok_unlimited').eq('id', mid).maybeSingle()
      if (produk && !produk.stok_unlimited && produk.stok != null) {
        await supabaseAdmin.from('merchandise').update({ stok: Number(produk.stok) + qty }).eq('id', mid)
      }
    }
    return NextResponse.json({ success: true, deleted: ids.length })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
