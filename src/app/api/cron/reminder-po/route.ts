import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kirimWhatsApp } from '@/lib/notifikasi-tiket'
import { formatDate, formatRupiah, todayISO } from '@/lib/utils'

export const dynamic = 'force-dynamic'

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

export async function GET(request: Request) {
  if (!auth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const targets = (process.env.FONNTE_GROUP_PO || process.env.FONNTE_GROUP_ID || '')
      .split(',')
      .map((target) => target.trim())
      .filter(Boolean)
    if (targets.length === 0) return NextResponse.json({ sent: 0, skipped: 'no_group_target' })

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
    if (!deadline) return NextResponse.json({ sent: false, skipped: 'no_deadline' })

    const hari = diffHari(deadline)
    if (hari < 1 || hari > 5) return NextResponse.json({ hari, sent: false })

    const { data: poList } = await supabaseAdmin
      .from('merch_po')
      .select('no_po,nama_pemesan,total,sudah_dibayar,status')
      .eq('tipe_pemesan', 'Pengurus Himpunan')

    const belumLunas = (poList ?? [])
      .filter((po) => !['lunas', 'batal', 'ditolak'].includes(String(po.status)))
      .map((po) => ({
        no_po: String(po.no_po),
        nama: String(po.nama_pemesan),
        sisa: Math.max(0, Number(po.total) - Number(po.sudah_dibayar ?? 0)),
      }))
      .filter((po) => po.sisa > 0)

    if (belumLunas.length === 0) return NextResponse.json({ hari, sent: false, skipped: 'all_paid' })

    const message = [
      '*Pengingat Pembayaran PO Merchandise*',
      '',
      `Batas pre-order: ${formatDate(deadline)} (H-${hari})`,
      '',
      'Pengurus yang belum melunasi:',
      ...belumLunas.map((po, index) => `${index + 1}. ${po.nama} (${po.no_po}) — sisa ${formatRupiah(po.sisa)}`),
      '',
      'Mohon segera selesaikan pembayaran melalui QRIS/Cash ke panitia sebelum batas pre-order.',
      '',
      'Hormat Kami,',
      'Panitia Danus In4Days XI',
    ].join('\n')

    let sent = 0
    for (const target of targets) {
      if (await kirimWhatsApp(target, message)) sent++
    }
    return NextResponse.json({ hari, total: belumLunas.length, groups: targets.length, sent })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
