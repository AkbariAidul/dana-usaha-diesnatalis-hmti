import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kirimWhatsApp } from '@/lib/notifikasi-tiket'
import { getAcara } from '@/lib/queries'
import { formatDate, formatRupiah, todayISO } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function auth(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : request.headers.get('x-cron-secret')
  return token === secret
}

function diffHari(target: string) {
  const today = new Date(`${todayISO()}T00:00:00Z`)
  const acara = new Date(`${target}T00:00:00Z`)
  return Math.round((acara.getTime() - today.getTime()) / 86400000)
}

export async function GET(request: Request) {
  if (!auth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const targets = (process.env.FONNTE_GROUP_TENANT || '')
      .split(',')
      .map((target) => target.trim())
      .filter(Boolean)
    if (targets.length === 0) return NextResponse.json({ sent: 0, skipped: 'no_group_target' })

    const acara = await getAcara()
    if (!acara?.tanggal_acara) return NextResponse.json({ sent: 0, skipped: 'no_acara_date' })

    const hari = diffHari(acara.tanggal_acara)
    if (hari < 1 || hari > 5) return NextResponse.json({ hari, sent: 0 })

    const [{ data: tenants }, { data: pembayaran }] = await Promise.all([
      supabaseAdmin
        .from('tenants')
        .select('id,kode_stand,nama_usaha,harga_akhir,status')
        .neq('status', 'batal'),
      supabaseAdmin
        .from('pembayaran')
        .select('tenant_id,nominal')
        .eq('validated', true),
    ])

    const dibayar = new Map<string, number>()
    for (const bayar of pembayaran ?? []) {
      const id = String(bayar.tenant_id)
      dibayar.set(id, (dibayar.get(id) ?? 0) + Number(bayar.nominal ?? 0))
    }

    const belumLayak = (tenants ?? [])
      .map((tenant) => {
        const harga = Number(tenant.harga_akhir ?? 0)
        const total = dibayar.get(String(tenant.id)) ?? 0
        const persen = harga > 0 ? (total / harga) * 100 : 0
        return {
          kode: String(tenant.kode_stand),
          nama: String(tenant.nama_usaha),
          harga,
          total,
          persen,
          kurang: Math.max(0, Math.ceil(harga * 0.8) - total),
        }
      })
      .filter((tenant) => tenant.harga > 0 && tenant.persen < 80)
      .sort((a, b) => a.persen - b.persen)

    if (belumLayak.length === 0) return NextResponse.json({ hari, sent: 0, skipped: 'all_eligible' })

    const message = [
      '*Pengingat Pembayaran Tenant*',
      '',
      `Persiapan tenant: ${formatDate(acara.tanggal_acara)} (H-${hari})`,
      '',
      'Tenant yang pembayarannya belum mencapai 80%:',
      ...belumLayak.map((tenant, index) =>
        `${index + 1}. ${tenant.nama} (${tenant.kode}) — ${tenant.persen.toFixed(0)}% · kurang ${formatRupiah(tenant.kurang)}`
      ),
      '',
      'QR registrasi tenant hanya aktif jika pembayaran tervalidasi minimal 80% dari total sewa.',
      'Segera selesaikan pembayaran agar bisa mendapatkan QR untuk registrasi saat persiapan tenant.',
      '',
      'Hormat Kami,',
      'Panitia Danus In4Days XI',
    ].join('\n')

    let sent = 0
    for (const target of targets) {
      if (await kirimWhatsApp(target, message)) sent++
    }
    return NextResponse.json({ hari, total: belumLayak.length, groups: targets.length, sent })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
