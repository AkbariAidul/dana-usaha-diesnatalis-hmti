import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createPembayaran } from '@/lib/queries'
import { todayISO } from '@/lib/utils'
import { kirimNotifTenantDitolak, kirimNotifTenantTerverifikasi } from '@/lib/notifikasi-tenant'

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

    // If approved, also create tenant in main table + catat DP dari bukti pendaftaran
    if (status === 'dp_diterima') {
      const { data: existing } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('kode_stand', data.kode_pendaftaran)
        .maybeSingle()

      let tenantId = existing?.id as string | undefined
      if (!tenantId) {
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
          jumlah_tenant: Number(data.jumlah_tenant ?? 1),
          sudah_dibayar: 0,
          tgl_daftar: data.tgl_daftar,
          tgl_acara: data.tgl_acara,
          addon: data.addon ?? [],
          status: 'daftar',
        }
        const { data: tenant, error: tenantError } = await supabaseAdmin
          .from('tenants')
          .insert(tenantData)
          .select('id')
          .single()
        if (tenantError) throw tenantError
        tenantId = tenant.id
      }

      if (tenantId) {
        const { data: dp } = await supabaseAdmin
          .from('pembayaran')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('jenis', 'DP')
          .maybeSingle()

        const nominalMasuk = Math.max(Number(data.dp_wajib), Number(data.nominal_bayar) || Number(data.dp_wajib))
        if (!dp) {
          await createPembayaran({
            tenant_id: tenantId,
            tanggal_bayar: todayISO(),
            jenis: nominalMasuk >= Number(data.harga_akhir) ? 'Pelunasan' : 'DP',
            nominal: nominalMasuk,
            metode: 'QRIS',
            no_ref: null,
            bukti_url: data.bukti_url,
            dicatat_oleh: 'Admin',
            keterangan: data.pembayaran_tipe === 'lunas' ? 'Pembayaran lunas dari pendaftaran publik' : 'DP dari pendaftaran publik',
            validated: true,
          })
        }

        await supabaseAdmin
          .from('tenants')
          .update({ sudah_dibayar: nominalMasuk })
          .eq('id', tenantId)

        await supabaseAdmin
          .from('pendaftaran_tenant_pub')
          .update({ sudah_dibayar: nominalMasuk })
          .eq('id', id)
      }
    }

    try {
      if (status === 'ditolak') {
        await kirimNotifTenantDitolak(request, data)
      } else if (status === 'dp_diterima') {
        const nominalMasuk = Math.max(Number(data.dp_wajib), Number(data.nominal_bayar) || Number(data.dp_wajib))
        await kirimNotifTenantTerverifikasi(request, {
          ...data,
          sudah_dibayar: nominalMasuk,
          nominal_bayar: nominalMasuk,
        })
      }
    } catch (notifError) {
      console.error('Notifikasi tenant gagal:', notifError)
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