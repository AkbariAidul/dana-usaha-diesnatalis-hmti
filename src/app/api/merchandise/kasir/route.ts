import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('kasir_transaksi')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) throw error
    
    const transformed = (data ?? []).map(item => ({
      id: item.id,
      tanggal: item.created_at || new Date().toISOString(),
      produk: item.produk_nama || item.produk || '-',
      qty: Number(item.qty),
      total: Number(item.total),
      metode: item.metode || 'Tunai',
      dicatat_oleh: item.dicatat_oleh || 'Admin',
    }))
    
    return NextResponse.json(transformed)
  } catch (err: unknown) {
    console.error('Kasir error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const merchandiseId = String(body.merchandise_id ?? '')
    const qty = Math.max(1, Math.min(999, Number(body.qty) || 1))
    if (!merchandiseId) {
      return NextResponse.json({ error: 'Produk wajib dipilih' }, { status: 400 })
    }

    const { data: produk, error: produkError } = await supabaseAdmin
      .from('merchandise')
      .select('id,nama,harga,stok,stok_unlimited')
      .eq('id', merchandiseId)
      .eq('aktif', true)
      .maybeSingle()
    if (produkError) throw produkError
    if (!produk) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 })

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

    const total = Number(produk.harga) * qty
    const { data, error } = await supabaseAdmin
      .from('kasir_transaksi')
      .insert({
        merchandise_id: merchandiseId,
        produk: produk.nama,
        produk_nama: produk.nama,
        qty,
        total,
        metode: body.metode || 'Tunai',
        dicatat_oleh: body.dicatat_oleh || 'Admin',
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