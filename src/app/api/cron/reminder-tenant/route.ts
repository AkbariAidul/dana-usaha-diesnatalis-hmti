import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kirimWhatsApp } from '@/lib/notifikasi-tiket'
import { pesanReminderTenant } from '@/lib/notifikasi-tenant'
import { getAcara } from '@/lib/queries'
import { todayISO } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function auth(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
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
    const acara = await getAcara()
    if (!acara) return NextResponse.json({ sent: 0, skipped: 'no_acara' })

    const preview = new URL(request.url).searchParams.get('preview') === '1'
    const batasPelunasan = acara.batas_pelunasan ? String(acara.batas_pelunasan) : null
    const hariBatas = batasPelunasan ? diffHari(batasPelunasan) : null

    const [{ data: tenants }, { data: pembayaran }] = await Promise.all([
      supabaseAdmin
        .from('tenants')
        .select('id,kode_stand,nama_usaha,kontak,harga_akhir,status')
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

    const belumLunas = (tenants ?? [])
      .map((tenant) => ({
        ...tenant,
        harga: Number(tenant.harga_akhir ?? 0),
        total: dibayar.get(String(tenant.id)) ?? 0,
      }))
      .filter((tenant) => tenant.harga > 0 && tenant.total < tenant.harga && String(tenant.kontak || '').trim())

    type PesanTenant = { kode_stand: string; nama_usaha: string; kontak: string; pesan: string }
    const messages: PesanTenant[] = []

    if (preview) {
      for (const tenant of belumLunas) {
        messages.push({
          kode_stand: String(tenant.kode_stand),
          nama_usaha: String(tenant.nama_usaha),
          kontak: String(tenant.kontak),
          pesan: pesanReminderTenant(
            request,
            {
              kode_stand: String(tenant.kode_stand),
              nama_usaha: String(tenant.nama_usaha),
              kontak: String(tenant.kontak),
              harga_akhir: tenant.harga,
              sudah_dibayar: tenant.total,
            },
            batasPelunasan ?? '',
            hariBatas ?? 0,
          ),
        })
      }
      return NextResponse.json({
        preview: true,
        hariBatas,
        belumLunas: belumLunas.length,
        sentTenant: 0,
        messages,
      })
    }

    // Reminder harian per penyewa: mulai H-5 batas pembayaran sampai lunas.
    let sentTenant = 0
    if (batasPelunasan && hariBatas !== null && hariBatas <= 5) {
      const today = todayISO()
      const { data: logs } = await supabaseAdmin
        .from('tenant_reminder_log')
        .select('tenant_id')
        .eq('tanggal', today)
      const sudahKirim = new Set((logs ?? []).map((log) => String(log.tenant_id)))

      for (const tenant of belumLunas) {
        if (sudahKirim.has(String(tenant.id))) continue
        const pesan = pesanReminderTenant(
          request,
          {
            kode_stand: String(tenant.kode_stand),
            nama_usaha: String(tenant.nama_usaha),
            kontak: String(tenant.kontak),
            harga_akhir: tenant.harga,
            sudah_dibayar: tenant.total,
          },
          batasPelunasan,
          hariBatas,
        )
        const ok = await kirimWhatsApp(String(tenant.kontak), pesan)
        if (ok) {
          sentTenant++
          messages.push({
            kode_stand: String(tenant.kode_stand),
            nama_usaha: String(tenant.nama_usaha),
            kontak: String(tenant.kontak),
            pesan,
          })
          await supabaseAdmin
            .from('tenant_reminder_log')
            .upsert({ tenant_id: tenant.id, tanggal: today }, { onConflict: 'tenant_id,tanggal' })
        }
      }
    }

    return NextResponse.json({
      hariBatas,
      belumLunas: belumLunas.length,
      sentTenant,
      messages,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
