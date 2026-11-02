import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { parseQrPayload } from '@/lib/link-token'
import { findPINByUser, type DashboardUser } from '@/lib/auth'

async function getSessionPIN(): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get('dashboard_user')?.value
    if (!raw) return null
    const user = JSON.parse(decodeURIComponent(raw)) as DashboardUser
    return user.name ? findPINByUser(user.name) : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = String(body.payload ?? '').trim()
    const confirm = body.action === 'confirm'
    const oleh = (await getSessionPIN()) || ''
    if (!payload) return NextResponse.json({ error: 'QR kosong' }, { status: 400 })
    if (confirm && !oleh) {
      return NextResponse.json({ error: 'Sesi PIN tidak ditemukan, silakan login ulang' }, { status: 401 })
    }

    if (payload.startsWith('DN26|')) {
      const parsed = parseQrPayload(payload)
      if (!parsed) return NextResponse.json({ error: 'QR tidak valid' }, { status: 400 })

      if (parsed.tipe === 'tenant') {
        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('*')
          .eq('kode_stand', parsed.kode)
          .maybeSingle()
        if (!tenant) return NextResponse.json({ error: 'Tenant tidak ditemukan' }, { status: 404 })

        const { data: payments } = await supabaseAdmin
          .from('pembayaran')
          .select('nominal,validated')
          .eq('tenant_id', tenant.id)
        const total = (payments ?? [])
          .filter((p) => p.validated === true)
          .reduce((s, p) => s + Number(p.nominal ?? 0), 0)
        const eligible = total >= Number(tenant.harga_akhir) * 0.8
        if (!eligible) {
          return NextResponse.json({ error: 'Pembayaran belum mencapai 80%' }, { status: 400 })
        }

        if (confirm && !tenant.venue_checked_in_at) {
          const { error } = await supabaseAdmin
            .from('tenants')
            .update({ venue_checked_in_at: new Date().toISOString(), venue_checked_in_by: oleh })
            .eq('id', tenant.id)
          if (error) throw error
        }

        return NextResponse.json({
          tipe: 'tenant',
          tenant,
          total,
          eligible,
          sudahMasuk: !!tenant.venue_checked_in_at || confirm,
          confirmed: confirm,
        })
      }

      const { data: po } = await supabaseAdmin
        .from('merch_po')
        .select('*')
        .eq('no_po', parsed.kode)
        .maybeSingle()
      if (!po) return NextResponse.json({ error: 'PO tidak ditemukan' }, { status: 404 })
      if (po.status !== 'lunas') {
        return NextResponse.json({ error: 'PO belum lunas' }, { status: 400 })
      }

      const { data: items } = await supabaseAdmin
        .from('merch_po_item')
        .select('*')
        .eq('po_id', po.id)
      const { data: varian } = await supabaseAdmin.from('merch_varian').select('id,nama')
      const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))

      if (confirm && !po.picked_up_at) {
        const { error } = await supabaseAdmin
          .from('merch_po')
          .update({ picked_up_at: new Date().toISOString(), picked_up_by: oleh })
          .eq('id', po.id)
        if (error) throw error
      }

      return NextResponse.json({
        tipe: 'po',
        po: {
          ...po,
          items: (items ?? []).map((i) => ({
            ...i,
            varian: i.varian_id ? { nama: varianMap.get(i.varian_id) ?? '' } : null,
          })),
        },
        sudahDiambil: !!po.picked_up_at || confirm,
        confirmed: confirm,
      })
    }

    let { data: tiket } = await supabaseAdmin
      .from('tiket_issued')
      .select('*')
      .eq('kode_qr', payload)
      .maybeSingle()
    if (!tiket) {
      const byTampil = await supabaseAdmin
        .from('tiket_issued')
        .select('*')
        .eq('kode_tampil', payload)
        .maybeSingle()
      tiket = byTampil.data
    }
    if (!tiket) return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 })

    const { data: pesanan } = await supabaseAdmin
      .from('pesanan_tiket')
      .select('no_pesanan,nama_pembeli,jumlah,tiket_tipe_id')
      .eq('id', tiket.pesanan_id)
      .maybeSingle()
    const { data: tipeTiket } = pesanan?.tiket_tipe_id
      ? await supabaseAdmin.from('tiket_tipe').select('nama').eq('id', pesanan.tiket_tipe_id).maybeSingle()
      : { data: null }

    if (confirm && tiket.status !== 'terpakai') {
      const { error } = await supabaseAdmin
        .from('tiket_issued')
        .update({
          status: 'terpakai',
          digunakan_oleh: oleh,
          digunakan_pada: new Date().toISOString(),
        })
        .eq('id', tiket.id)
      if (error) throw error

      await supabaseAdmin.from('checkin_log').insert({
        tiket_issued_id: tiket.id,
        kode_qr: tiket.kode_qr,
        aksi: 'checkin',
        dicatat_oleh: oleh,
      })
    }

    return NextResponse.json({
      tipe: 'tiket',
      tiket,
      pesanan: pesanan ? { ...pesanan, tiket_tipe: tipeTiket ?? null } : null,
      sudahCheckin: tiket.status === 'terpakai' || confirm,
      confirmed: confirm,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
