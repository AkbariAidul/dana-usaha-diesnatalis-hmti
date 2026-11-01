import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getPeralatanMeta, savePeralatanMeta, getKomposisiPeralatan, saveKomposisiPeralatan } from '@/lib/peralatan'

type Item = { id: string; nama: string; jenis: string; jumlah: number; status: string } & Record<string, unknown>

function withMeta(item: Item, meta: Record<string, { harga_satuan: number; vendor: string }>) {
  return {
    ...item,
    harga_satuan: Number(meta[item.id]?.harga_satuan ?? 0),
    vendor: meta[item.id]?.vendor ?? '',
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.from('peralatan').select('*').order('created_at', { ascending: false })
    if (error) throw error
    const meta = await getPeralatanMeta()
    return NextResponse.json(((data ?? []) as Item[]).map((item) => withMeta(item, meta)))
  } catch (err: unknown) {
    console.error('Peralatan error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.nama) {
      return NextResponse.json({ error: 'Nama barang wajib diisi' }, { status: 400 })
    }
    const row = {
      nama: body.nama,
      jenis: body.jenis || 'Tenda',
      jumlah: Number(body.jumlah) || 1,
      catatan: body.catatan || null,
      updated_at: new Date().toISOString(),
    }
    let item: Item
    if (body.id) {
      const { data, error } = await supabaseAdmin.from('peralatan').update(row).eq('id', body.id).select().single()
      if (error) throw error
      item = data as Item
    } else {
      const { data, error } = await supabaseAdmin.from('peralatan').insert({ ...row, status: 'tersedia' }).select().single()
      if (error) throw error
      item = data as Item
    }
    const meta = await getPeralatanMeta()
    meta[item.id] = { harga_satuan: Number(body.harga_satuan) || 0, vendor: body.vendor || '' }
    await savePeralatanMeta(meta)
    return NextResponse.json(withMeta(item, meta), { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of ['nama', 'jenis', 'jumlah', 'status', 'catatan']) {
      if (body[key] !== undefined) update[key] = body[key]
    }
    const { data, error } = await supabaseAdmin.from('peralatan').update(update).eq('id', body.id).select().single()
    if (error) throw error

    const meta = await getPeralatanMeta()
    if (body.harga_satuan !== undefined || body.vendor !== undefined) {
      meta[body.id] = {
        harga_satuan: Number(body.harga_satuan ?? meta[body.id]?.harga_satuan ?? 0),
        vendor: body.vendor ?? meta[body.id]?.vendor ?? '',
      }
      await savePeralatanMeta(meta)
    }
    return NextResponse.json(withMeta(data as Item, meta))
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 })
    await supabaseAdmin.from('peralatan').delete().eq('id', id)

    const meta = await getPeralatanMeta()
    delete meta[id]
    await savePeralatanMeta(meta)

    const komposisi = await getKomposisiPeralatan()
    let changed = false
    for (const kategoriId of Object.keys(komposisi)) {
      if (komposisi[kategoriId]?.[id] !== undefined) {
        delete komposisi[kategoriId][id]
        changed = true
      }
    }
    if (changed) await saveKomposisiPeralatan(komposisi)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
