import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { hitungDiskon } from '@/lib/merch-diskon'
import type { DashboardUser } from '@/lib/auth'

async function getSessionUser(): Promise<DashboardUser | null> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get('dashboard_user')?.value
    if (!raw) return null
    const user = JSON.parse(decodeURIComponent(raw)) as DashboardUser
    return user.name ? user : null
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const ringkasan = new URL(request.url).searchParams.get('ringkasan') === '1'
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
      .limit(50)
    
    if (error) throw error
    
    const transformed = (data ?? []).map(item => ({
      id: item.id,
      merchandise_id: item.merchandise_id ?? null,
      tanggal: item.created_at || new Date().toISOString(),
      produk: item.produk_nama || item.produk || '-',
      qty: Number(item.qty),
      total: Number(item.total),
      diskon: Number(item.diskon ?? 0),
      metode: item.metode || 'Tunai',
      dicatat_oleh: item.dicatat_oleh || 'Admin',
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
      .select('id,nama,harga,stok,stok_unlimited,diskon')
      .eq('id', merchandiseId)
      .eq('aktif', true)
      .maybeSingle()
    if (produkError) throw produkError
    if (!produk) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })
    if (Number(produk.harga) <= 0) {
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

    const hitung = hitungDiskon(qty, Number(produk.harga), produk.diskon, 'hari_h')
    const { data, error } = await supabaseAdmin
      .from('kasir_transaksi')
      .insert({
        merchandise_id: merchandiseId,
        produk: produk.nama,
        produk_nama: produk.nama,
        qty,
        total: hitung.total,
        diskon: hitung.diskon,
        metode: body.metode || 'Tunai',
        dicatat_oleh: kasir.name,
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
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
