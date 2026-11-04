import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kirimWhatsApp } from '@/lib/notifikasi-tiket'
import { linkPo } from '@/lib/notifikasi-po'
import { formatDate, formatRupiah, todayISO } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const LUNAS_KEY = 'reminder_po_lunas_dikirim'

function auth(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : request.headers.get('x-cron-secret')
  return token === secret
}

function tanggalWib(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d)
}

function diffHari(target: string) {
  const today = new Date(`${todayISO()}T00:00:00Z`)
  const batas = new Date(`${target}T00:00:00Z`)
  return Math.round((batas.getTime() - today.getTime()) / 86400000)
}

function kunciPengurus(po: { pengurus_id?: string | null; nama_pemesan: string }) {
  return String(po.pengurus_id || po.nama_pemesan).trim().toLowerCase()
}

export async function GET(request: Request) {
  if (!auth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const force = url.searchParams.get('force') === '1'
  const dry = url.searchParams.get('dry') === '1'
  const scenarioLunas = (dry || force) && url.searchParams.get('scenario') === 'lunas'

  try {
    const targets = (process.env.FONNTE_GROUP_PO || process.env.FONNTE_GROUP_ID || '')
      .split(',')
      .map((target) => target.trim())
      .filter(Boolean)
    if (targets.length === 0 && !dry) return NextResponse.json({ sent: 0, skipped: 'no_group_target' })

    const { data: produk } = await supabaseAdmin
      .from('merchandise')
      .select('po_selesai')
      .not('harga_po', 'is', null)
      .not('po_selesai', 'is', null)

    const today = todayISO()
    const deadline = (produk ?? [])
      .map((p) => tanggalWib(String(p.po_selesai)))
      .filter((d) => d && d >= today)
      .sort()[0]

    const { data: poList } = await supabaseAdmin
      .from('merch_po')
      .select('id,no_po,nama_pemesan,pengurus_id,total,sudah_dibayar,status')
      .eq('tipe_pemesan', 'Pengurus Himpunan')

    const poValid = (poList ?? []).filter(
      (po) => !['batal', 'ditolak'].includes(String(po.status))
    )
    const effectivePo = scenarioLunas ? poValid.map((po) => ({ ...po, status: 'lunas' })) : poValid

    const grupBelumLunas = new Map<string, { nama: string; items: { no_po: string; sisa: number; link: string }[] }>()
    for (const po of effectivePo) {
      if (String(po.status) === 'lunas') continue
      const sisa = Math.max(0, Number(po.total) - Number(po.sudah_dibayar ?? 0))
      if (sisa <= 0) continue
      const key = kunciPengurus(po)
      const grup = grupBelumLunas.get(key) ?? { nama: String(po.nama_pemesan).trim(), items: [] }
      grup.items.push({ no_po: String(po.no_po), sisa, link: linkPo(request, String(po.no_po)) })
      grupBelumLunas.set(key, grup)
    }
    const belumLunas = [...grupBelumLunas.values()]
    const hari = deadline ? diffHari(deadline) : null

    if (belumLunas.length === 0) {
      const semuaLunas = effectivePo.length > 0 && effectivePo.every((po) => String(po.status) === 'lunas')
      if (!semuaLunas) return NextResponse.json({ sent: false, skipped: 'no_unpaid' })

      const marker = effectivePo.map((po) => String(po.id)).sort().join(',')
      if (!force && !dry) {
        const { data: setting } = await supabaseAdmin
          .from('pengaturan_umum')
          .select('value')
          .eq('key', LUNAS_KEY)
          .maybeSingle()
        if (setting?.value === marker) {
          return NextResponse.json({ sent: false, skipped: 'already_sent', deadline })
        }
      }

      const lunasIds = effectivePo.map((po) => String(po.id))
      const [{ data: items }, { data: modalItems }] = await Promise.all([
        lunasIds.length
          ? supabaseAdmin.from('merch_po_item').select('qty').in('po_id', lunasIds)
          : Promise.resolve({ data: [] as { qty: number | null }[] }),
        supabaseAdmin.from('merch_modal_item').select('harga'),
      ])
      const totalQty = (items ?? []).reduce((sum, item) => sum + Number(item.qty ?? 0), 0)
      const modalSatuan = (modalItems ?? []).reduce((sum, item) => sum + Number(item.harga ?? 0), 0)
      const modalTotal = modalSatuan * totalQty
      const totalMasuk = effectivePo.reduce((sum, po) => sum + Number(po.total ?? 0), 0)
      const untung = totalMasuk - modalTotal
      const { count: jumlahPengurus } = await supabaseAdmin
        .from('pengurus')
        .select('*', { count: 'exact', head: true })
      const totalPengurus = jumlahPengurus ?? new Set(effectivePo.map(kunciPengurus)).size

      const message = [
        '*Terima Kasih Pre-Order Merchandise*',
        '',
        `Alhamdulillah, seluruh pengurus yang melakukan pre-order sudah melunasi pembayarannya.`,
        '',
        `Total pengurus: ${totalPengurus} orang`,
        `Total uang masuk: ${formatRupiah(totalMasuk)}`,
        `Biaya cetak ke percetakan: ${formatRupiah(modalTotal)}`,
        `Keuntungan HIMA: ${formatRupiah(untung)}`,
        '',
        'Terima kasih atas partisipasi teman-teman.',
        '',
        'Hormat Kami,',
        'Panitia Danus In4Days XI',
      ].join('\n')

      if (dry) {
        return NextResponse.json({
          dry: true,
          deadline,
          totalPengurus,
          totalMasuk,
          totalQty,
          modalTotal,
          untung,
          message,
        })
      }

      let sent = 0
      for (const target of targets) {
        if (await kirimWhatsApp(target, message)) sent++
      }
      if (sent > 0 && !force) {
        await supabaseAdmin.from('pengaturan_umum').upsert(
          { key: LUNAS_KEY, value: marker, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
      }
      return NextResponse.json({ sent, groups: targets.length, totalPengurus, totalMasuk, modalTotal, untung })
    }

    if (!deadline) return NextResponse.json({ sent: false, skipped: 'no_deadline' })
    if (!force && (hari === null || hari < 1 || hari > 5)) return NextResponse.json({ hari, sent: false })

    const message = [
      '*Pengingat Pembayaran PO Merchandise*',
      '',
      `PO ditutup: ${formatDate(deadline)} (H-${hari})`,
      `Total pengurus belum lunas: ${belumLunas.length} orang`,
      '',
      'Daftar pengurus yang belum melunasi:',
      ...belumLunas.flatMap((grup, index) => {
        if (grup.items.length === 1) {
          const item = grup.items[0]
          return [
            `${index + 1}. ${grup.nama} (${item.no_po}) - sisa ${formatRupiah(item.sisa)}`,
            `   Bayar/cicil: ${item.link}`,
          ]
        }
        return [
          `${index + 1}. ${grup.nama} - total sisa ${formatRupiah(
            grup.items.reduce((sum, item) => sum + item.sisa, 0)
          )}`,
          ...grup.items.flatMap((item) => [
            `   ${item.no_po}: sisa ${formatRupiah(item.sisa)}`,
            `   Bayar/cicil: ${item.link}`,
          ]),
        ]
      }),
      '',
      'Mohon segera selesaikan pembayaran melalui QRIS/Cash ke panitia sebelum batas pre-order.',
      '',
      'Hormat Kami,',
      'Panitia Danus In4Days XI',
    ].join('\n')

    if (dry) {
      return NextResponse.json({
        dry: true,
        deadline,
        hari,
        totalPengurus: belumLunas.length,
        totalPo: belumLunas.reduce((sum, grup) => sum + grup.items.length, 0),
        message,
      })
    }

    let sent = 0
    for (const target of targets) {
      if (await kirimWhatsApp(target, message)) sent++
    }
    return NextResponse.json({
      hari,
      totalPengurus: belumLunas.length,
      totalPo: belumLunas.reduce((sum, grup) => sum + grup.items.length, 0),
      groups: targets.length,
      sent,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
