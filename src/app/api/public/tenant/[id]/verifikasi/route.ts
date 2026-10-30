import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, catatan_admin } = body

    // Update pendaftaran status
    const { data, error } = await supabaseAdmin
      .from('pendaftaran_tenant_pub')
      .update({
        status,
        catatan_admin,
        verified_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // If approved, also create tenant in main table
    if (status === 'dp_diterima') {
      const tenantData = {
        kode_stand: data.kode_pendaftaran,
        nama_usaha: data.nama_usaha,
        kontak: data.kontak,
        email: data.email,
        kategori_sewa_id: data.kategori_sewa_id,
        jenis_usaha: data.jenis_usaha,
        asal: data.asal,
        lokasi: data.lokasi,
        periode_daftar: data.periode_daftar,
        harga_akhir: Number(data.harga_akhir),
        dp_wajib: Number(data.dp_wajib),
        sudah_dibayar: Number(data.sudah_dibayar),
        tgl_daftar: data.tgl_daftar,
        tgl_acara: data.tgl_acara,
        status: 'daftar',
      }
      
      await supabaseAdmin.from('tenants').insert(tenantData)
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

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