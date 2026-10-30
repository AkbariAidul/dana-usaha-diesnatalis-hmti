import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const existing = await supabaseAdmin.from('pendaftaran_tenant_pub').select('kode_pendaftaran')
    const maxKode = (existing.data || []).reduce((m: number, t: { kode_pendaftaran: string }) => {
      const n = Number(/(\d+)$/.exec(t.kode_pendaftaran)?.[1] ?? 0)
      return n > m ? n : m
    }, 0)
    const kode = `TP-${String(maxKode + 1).padStart(4, '0')}`
    const payload = { ...body, kode_pendaftaran: kode, status: 'menunggu_verifikasi', sudah_dibayar: 0 }
    const { data, error } = await supabaseAdmin.from('pendaftaran_tenant_pub').insert(payload).select().single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
