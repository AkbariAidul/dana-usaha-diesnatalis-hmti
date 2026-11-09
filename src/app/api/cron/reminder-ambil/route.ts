import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kirimWhatsApp } from '@/lib/notifikasi-tiket'
import { linkPo } from '@/lib/notifikasi-po'
import { formatDate, todayISO } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const KEY_TANGGAL = 'merch_pengambilan_tanggal'
const KEY_LOKASI = 'merch_pengambilan_lokasi'
const KEY_NOTIF_H2 = 'merch_pengambilan_notif_h2'
const KEY_NOTIF_H0 = 'merch_pengambilan_notif_h0'
const PENUTUP = 'Hormat Kami,\nPanitia Danus In4Days XI'

type PoRow = {
  no_po: string
  nama_pemesan: string
  kontak: string | null
  status: string
  tipe_pemesan: string
  picked_up_at: string | null
}

function auth(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : request.headers.get('x-cron-secret')
  return token === secret
}

function diffHari(target: string) {
  const today = new Date(`${todayISO()}T00:00:00Z`)
  const batas = new Date(`${target}T00:00:00Z`)
  return Math.round((batas.getTime() - today.getTime()) / 86400000)
}

function pesanGrup(event: 'h2' | 'h0', tanggal: string, lokasi: string, pengurusLunas: number, umumLunas: number) {
  const judul = event === 'h0' ? '*Hari Ini Pengambilan Merchandise*' : '*Pengingat Pengambilan Merchandise*'
  const kapan = event === 'h0' ? 'hari ini' : '2 hari lagi'
  return [
    judul,
    '',
    `Pengambilan merchandise Danus In4Days XI ${kapan}:`,
    `Tanggal: ${formatDate(tanggal)}`,
    `Lokasi: ${lokasi}`,
    '',
    'Khusus yang sudah lunas.',
    'Yang belum lunas belum bisa mengambil merchandise. Silakan selesaikan pembayaran dulu di halaman riwayat masing-masing.',
    '',
    'Tunjukkan QR pengambilan ke petugas saat mengambil.',
    '',
    `PO pengurus lunas: ${pengurusLunas}`,
    `PO umum lunas: ${umumLunas}`,
    '',
    PENUTUP,
  ].join('\n')
}

function pesanUmum(request: Request, event: 'h2' | 'h0', tanggal: string, lokasi: string, po: PoRow) {
  const link = linkPo(request, po.no_po)
  const kapan = event === 'h0' ? 'hari ini' : '2 hari lagi'
  return [
    `Halo ${po.nama_pemesan},`,
    '',
    `Merchandise PO kamu (${po.no_po}) siap diambil ${kapan}.`,
    '',
    `Tanggal: ${formatDate(tanggal)}`,
    `Lokasi: ${lokasi}`,
    '',
    `Tunjukkan QR pengambilan di halaman riwayat: ${link}`,
    '',
    PENUTUP,
  ].join('\n')
}

export async function GET(request: Request) {
  if (!auth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const force = url.searchParams.get('force') === '1'
  const dry = url.searchParams.get('dry') === '1'
  const eventParam = url.searchParams.get('event')
  if (eventParam && eventParam !== 'h2' && eventParam !== 'h0') {
    return NextResponse.json({ error: 'event harus h2 atau h0' }, { status: 400 })
  }

  try {
    const [{ data: tglRow }, { data: lokasiRow }] = await Promise.all([
      supabaseAdmin.from('pengaturan_umum').select('value').eq('key', KEY_TANGGAL).maybeSingle(),
      supabaseAdmin.from('pengaturan_umum').select('value').eq('key', KEY_LOKASI).maybeSingle(),
    ])
    const tanggal = String(tglRow?.value || '').trim()
    const lokasi = String(lokasiRow?.value || '').trim()
    if (!tanggal || !lokasi) return NextResponse.json({ sent: false, skipped: 'no_pengambilan' })

    const hari = diffHari(tanggal)
    let event: 'h2' | 'h0' | null =
      eventParam === 'h2' || eventParam === 'h0'
        ? eventParam
        : hari === 2
          ? 'h2'
          : hari === 0
            ? 'h0'
            : null
    if ((force || dry) && !event) event = 'h2'
    if (!event) return NextResponse.json({ hari, sent: false, skipped: 'not_today' })

    const markerKey = event === 'h0' ? KEY_NOTIF_H0 : KEY_NOTIF_H2
    if (!force && !dry) {
      const { data: marker } = await supabaseAdmin
        .from('pengaturan_umum')
        .select('value')
        .eq('key', markerKey)
        .maybeSingle()
      if (marker?.value === tanggal) {
        return NextResponse.json({ event, hari, sent: false, skipped: 'already_sent' })
      }
    }

    const { data: poList } = await supabaseAdmin
      .from('merch_po')
      .select('no_po,nama_pemesan,kontak,status,tipe_pemesan,picked_up_at')
    const list = (poList ?? []) as PoRow[]

    const pengurusLunas = list.filter(
      (po) => po.tipe_pemesan === 'Pengurus Himpunan' && po.status === 'lunas' && !po.picked_up_at
    )
    const umum = list.filter(
      (po) => po.tipe_pemesan === 'Umum' && po.status === 'lunas' && !po.picked_up_at
    )
    const umumLunas = umum.length

    const groupMessage = pesanGrup(event, tanggal, lokasi, pengurusLunas.length, umumLunas)
    const umumMessages = umum.map((po) => ({
      no_po: po.no_po,
      nama: po.nama_pemesan,
      kontak: po.kontak || '',
      status: po.status,
      message: pesanUmum(request, event, tanggal, lokasi, po),
    }))

    if (dry) {
      return NextResponse.json({
        dry: true,
        event,
        hari,
        tanggal,
        lokasi,
        pengurus_lunas: pengurusLunas.length,
        umum: umumMessages,
        group_message: groupMessage,
      })
    }

    const targets = (process.env.FONNTE_GROUP_PO || process.env.FONNTE_GROUP_ID || '')
      .split(',')
      .map((target) => target.trim())
      .filter(Boolean)

    let groupSent = 0
    for (const target of targets) {
      if (await kirimWhatsApp(target, groupMessage)) groupSent++
    }

    let umumSent = 0
    let umumFailed = 0
    for (const po of umumMessages) {
      if (!po.kontak) {
        umumFailed++
        continue
      }
      if (await kirimWhatsApp(po.kontak, po.message)) umumSent++
      else umumFailed++
    }

    if (!force && (groupSent > 0 || umumSent > 0)) {
      await supabaseAdmin.from('pengaturan_umum').upsert(
        { key: markerKey, value: tanggal, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )
    }

    return NextResponse.json({
      event,
      hari,
      tanggal,
      lokasi,
      group: { sent: groupSent, targets: targets.length },
      umum: { total: umumMessages.length, sent: umumSent, failed: umumFailed },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
