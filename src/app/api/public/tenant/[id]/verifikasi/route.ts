import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createPembayaran, createAuditLog } from '@/lib/queries'
import { todayISO } from '@/lib/utils'
import { kirimNotifTenantDitolak, kirimNotifTenantTerverifikasi } from '@/lib/notifikasi-tenant'
import { getSessionUser } from '@/lib/session-server'

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return String(err)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Security: hanya user yang login (bukan publik) yang bisa memverifikasi pendaftaran
  const session = await getSessionUser()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await request.json()
    const { status, catatan_admin } = body
    if (status !== 'dp_diterima' && status !== 'ditolak') {
      return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 })
    }

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
    await createAuditLog({ aksi: status === 'ditolak' ? 'TOLAK_PENDAFTARAN' : 'VERIFIKASI_PENDAFTARAN', target_type: 'pendaftaran_tenant_pub', target_id: id, data_baru: { status, catatan_admin }, user_name: session.name })

    // If approved, also create tenant in main table + catat DP dari bukti pendaftaran
    if (status === 'dp_diterima') {
      const { data: existing } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('kode_stand', data.kode_pendaftaran)
        .maybeSingle()

      let tenantId = existing?.id as string | undefined
      if (!tenantId) {
        // Ambil harga dasar sewa tempat dari kategori & periode yang dipilih
        const { data: hargaRows } = await supabaseAdmin
          .from('harga_dasar')
          .select('harga, jenis_usaha')
          .eq('kategori_sewa_id', data.kategori_sewa_id)
          .eq('periode', data.periode_daftar)
        const byJenis = new Map(
          (hargaRows ?? []).map((h: { harga: number; jenis_usaha: string }) => [h.jenis_usaha, Number(h.harga)]),
        )
        const jumlahTenant = Number(data.jumlah_tenant ?? 1)
        const qty = data.jenis_usaha_qty as { fnb?: number; nonFnb?: number } | null
        const baseHargaTotal = qty
          ? (byJenis.get('F&B') ?? 0) * Number(qty.fnb ?? 0) + (byJenis.get('Non-F&B') ?? 0) * Number(qty.nonFnb ?? 0)
          : (byJenis.get(String(data.jenis_usaha)) ?? (hargaRows?.[0] ? Number(hargaRows[0].harga) : Number(data.harga_akhir))) * jumlahTenant

        const tenantData = {
          kode_stand: data.kode_pendaftaran,
          nama_usaha: data.nama_usaha,
          kontak: data.kontak,
          email: data.email,
          kategori_sewa_id: data.kategori_sewa_id,
          jenis_usaha: data.jenis_usaha,
          jenis_usaha_qty: data.jenis_usaha_qty ?? null,
          asal: data.asal,
          lokasi: data.lokasi,
          periode_daftar: data.periode_daftar,
          harga_akhir: Number(data.harga_akhir),
          base_harga: Math.round(baseHargaTotal),
          dp_wajib: Number(data.dp_wajib),
          jumlah_tenant: jumlahTenant,
          sudah_dibayar: 0,
          tgl_daftar: data.tgl_daftar,
          tgl_acara: data.tgl_acara,
          addon: data.addon ?? [],
          status: 'daftar',
        }
        let inserted = await supabaseAdmin
          .from('tenants')
          .insert(tenantData)
          .select('id')
          .single()
        if (inserted.error && String(inserted.error.message).includes('jenis_usaha_qty')) {
          // ponytail: kolom belum ada (migrasi 037 belum dijalankan). Tetap buat tenant.
          const rest = { ...tenantData }
          delete (rest as Record<string, unknown>).jenis_usaha_qty
          inserted = await supabaseAdmin.from('tenants').insert(rest).select('id').single()
        }
        if (inserted.error) throw inserted.error
        tenantId = inserted.data.id
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
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}

export async function GET() {
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { data, error } = await supabaseAdmin
      .from('pendaftaran_tenant_pub')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 })
  }
}