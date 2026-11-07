import { after, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parseQrPayload } from '@/lib/link-token'
import { kirimNotifCheckin } from '@/lib/notifikasi-tiket'
import { kirimNotifPoDiambil } from '@/lib/notifikasi-po'
import { kirimNotifTenantCheckin } from '@/lib/notifikasi-tenant'
import { createAuditLog } from '@/lib/queries'
import { getSessionUser } from '@/lib/session-server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payload = String(body.payload ?? '').trim()
    const confirm = body.action === 'confirm'
    const oleh = (await getSessionUser())?.name || ''
    if (!payload) return NextResponse.json({ error: 'QR kosong' }, { status: 400 })
    if (confirm && !oleh) {
      return NextResponse.json({ error: 'Sesi login tidak ditemukan, silakan login ulang' }, { status: 401 })
    }

    if (payload.startsWith('DN26|')) {
      const parsed = parseQrPayload(payload)
      if (!parsed) return NextResponse.json({ error: 'QR tidak valid' }, { status: 400 })

      if (parsed.tipe === 'tenant') {
        const { data: tenant } = await supabaseAdmin
          .from('tenants')
          .select('*, kategori_sewa(kode, nama)')
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
          await createAuditLog({ aksi: 'CHECKIN_TENANT', target_type: 'tenants', target_id: tenant.id, data_baru: { venue_checked_in_by: oleh } })
          after(() =>
            kirimNotifTenantCheckin(request, {
              ...tenant,
              sudah_dibayar: total,
            }).catch((notifError) => console.error('Notifikasi tenant gagal:', notifError))
          )
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
      const [{ data: varian }, { data: merchandise }] = await Promise.all([
        supabaseAdmin.from('merch_varian').select('id,nama'),
        supabaseAdmin.from('merchandise').select('id,nama,gambar_url'),
      ])
      const varianMap = new Map((varian ?? []).map((v) => [v.id, v.nama]))
      const merchandiseMap = new Map((merchandise ?? []).map((m) => [m.id, m]))

      const pickedUpAt = po.picked_up_at ?? (confirm ? new Date().toISOString() : null)
      if (confirm && !po.picked_up_at) {
        const { error } = await supabaseAdmin
          .from('merch_po')
          .update({ picked_up_at: pickedUpAt, picked_up_by: oleh })
          .eq('id', po.id)
        if (error) throw error
        await createAuditLog({ aksi: 'PICKUP_PO', target_type: 'merch_po', target_id: po.id, data_baru: { picked_up_by: oleh } })

        after(() =>
          kirimNotifPoDiambil(request, {
            ...po,
            picked_up_at: pickedUpAt,
            items: (items ?? []).map((i) => ({
              nama_produk: merchandiseMap.get(i.merchandise_id ?? '')?.nama ?? 'Item',
              ukuran: i.varian_id ? varianMap.get(i.varian_id) ?? null : null,
              qty: Number(i.qty),
              harga_satuan: Number(i.harga_satuan),
              subtotal: Number(i.subtotal),
            })),
          })
        )
      }

      return NextResponse.json({
        tipe: 'po',
        po: {
          ...po,
          picked_up_at: pickedUpAt,
          items: (items ?? []).map((i) => ({
            ...i,
            merchandise: i.merchandise_id ? merchandiseMap.get(i.merchandise_id) ?? null : null,
            varian: i.varian_id ? { nama: varianMap.get(i.varian_id) ?? '' } : null,
          })),
        },
        sudahDiambil: !!pickedUpAt,
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
      .select('*')
      .eq('id', tiket.pesanan_id)
      .maybeSingle()
    const { data: tipeTiket } = pesanan?.tiket_tipe_id
      ? await supabaseAdmin.from('tiket_tipe').select('nama').eq('id', pesanan.tiket_tipe_id).maybeSingle()
      : { data: null }
    const { data: periods } = pesanan?.tiket_tipe_id
      ? await supabaseAdmin.from('tiket_periode').select('*').eq('tiket_tipe_id', pesanan.tiket_tipe_id)
      : { data: [] }
    const createdAt = pesanan?.created_at ? new Date(String(pesanan.created_at)) : null
    const tanggal = createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      : ''
    const periode = periods?.find((p) => tanggal >= p.tanggal_mulai && tanggal <= p.tanggal_selesai)
    const { data: issuedList } = await supabaseAdmin
      .from('tiket_issued')
      .select('id,kode_tampil')
      .eq('pesanan_id', tiket.pesanan_id)
      .order('kode_tampil')
    const nomor = (issuedList ?? []).findIndex((x) => x.id === tiket.id) + 1
    const totalTiket = issuedList?.length || 1

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
      await createAuditLog({ aksi: 'CHECKIN_TIKET', target_type: 'tiket_issued', target_id: tiket.id, data_baru: { digunakan_oleh: oleh } })

      if (pesanan) {
        after(() =>
          kirimNotifCheckin(
            request,
            pesanan,
            tipeTiket?.nama ?? 'Tiket',
            nomor || 1,
            totalTiket
          )
        )
      }
    }

    return NextResponse.json({
      tipe: 'tiket',
      tiket: { ...tiket, nomor: nomor || 1, total: totalTiket },
      pesanan: pesanan
        ? { ...pesanan, tiket_tipe: tipeTiket ?? null, periode_nama: periode?.nama ?? null }
        : null,
      sudahCheckin: tiket.status === 'terpakai' || confirm,
      confirmed: confirm,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
