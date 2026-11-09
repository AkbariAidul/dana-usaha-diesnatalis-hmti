import { randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { supabaseAdmin } from './supabase'
import { getSessionUser } from './session-server'
import { requestIp, requestLocation } from './request-meta'
import { todayISO } from './utils'
import { compressToWebp } from './image-compress'
import type { Tenant, Pembayaran, KategoriSewa, KategoriPilihan, KategoriBundleDiscount, HargaDasar, FaktorHarga, Acara, Merchandise, MerchModalItem, Ticket, TicketPeriode, TicketKatalogItem, TicketBundleDiscount, TicketModalItem, PesananTiket, PeriodeHarga } from './types'

// ─── Acara ───────────────────────────────────────────────────────────────────

export async function getAcara(): Promise<Acara | null> {
  const { data } = await supabaseAdmin.from('acara').select('*').limit(1).maybeSingle()
  return data
}

export async function upsertAcara(payload: Partial<Acara>) {
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('acara').update(payload).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('acara').insert(payload).select().single()
  if (error) throw error
  return data
}

// ─── Kategori Sewa ────────────────────────────────────────────────────────────

export async function getKategoriSewa(): Promise<KategoriSewa[]> {
  const { data, error } = await supabaseAdmin.from('kategori_sewa').select('*').order('kode')
  if (error) throw error
  return data ?? []
}

export async function upsertKategoriSewa(payload: Partial<KategoriSewa>) {
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('kategori_sewa').update(payload).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('kategori_sewa').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function deleteKategoriSewa(id: string) {
  const { error } = await supabaseAdmin.from('kategori_sewa').delete().eq('id', id)
  if (error) throw error
}

const KATEGORI_PILIHAN_FIELDS = ['kategori_sewa_id', 'nama', 'harga', 'urutan', 'gambar_url'] as const

export async function getKategoriPilihan(kategoriId?: string): Promise<KategoriPilihan[]> {
  let query = supabaseAdmin.from('kategori_pilihan').select('*').order('urutan').order('nama')
  if (kategoriId) query = query.eq('kategori_sewa_id', kategoriId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as KategoriPilihan[]
}

export async function upsertKategoriPilihan(payload: Partial<KategoriPilihan>) {
  const fields = pickFields(payload as Record<string, unknown>, KATEGORI_PILIHAN_FIELDS)
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('kategori_pilihan').update(fields).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('kategori_pilihan').insert(fields).select().single()
  if (error) throw error
  return data
}

export async function deleteKategoriPilihan(id: string) {
  const { error } = await supabaseAdmin.from('kategori_pilihan').delete().eq('id', id)
  if (error) throw error
}

export async function reorderKategoriPilihan(ids: string[]) {
  const results = await Promise.all(
    ids.map((id, urutan) => supabaseAdmin.from('kategori_pilihan').update({ urutan }).eq('id', id)),
  )
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}

const KATEGORI_BUNDLE_FIELDS = ['kategori_sewa_id', 'jumlah_min', 'diskon_nominal', 'diskon_persen', 'urutan'] as const

export async function getKategoriBundleDiscount(kategoriId?: string): Promise<KategoriBundleDiscount[]> {
  let query = supabaseAdmin.from('kategori_bundle_discount').select('*').order('urutan').order('jumlah_min')
  if (kategoriId) query = query.eq('kategori_sewa_id', kategoriId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as KategoriBundleDiscount[]
}

export async function upsertKategoriBundleDiscount(payload: Partial<KategoriBundleDiscount>) {
  const fields = pickFields(payload as Record<string, unknown>, KATEGORI_BUNDLE_FIELDS)
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('kategori_bundle_discount').update(fields).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('kategori_bundle_discount').insert(fields).select().single()
  if (error) throw error
  return data
}

export async function deleteKategoriBundleDiscount(id: string) {
  const { error } = await supabaseAdmin.from('kategori_bundle_discount').delete().eq('id', id)
  if (error) throw error
}

// ─── Harga Dasar ─────────────────────────────────────────────────────────────

export async function getHargaDasar(): Promise<HargaDasar[]> {
  const { data, error } = await supabaseAdmin.from('harga_dasar').select('*')
  if (error) throw error
  return data ?? []
}

export async function upsertHargaDasar(payload: Partial<HargaDasar>) {
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('harga_dasar').update(payload).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('harga_dasar').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function deleteHargaDasar(id: string) {
  const { error } = await supabaseAdmin.from('harga_dasar').delete().eq('id', id)
  if (error) throw error
}

// ─── Periode Harga ───────────────────────────────────────────────────────────

const DEFAULT_PERIODE: PeriodeHarga[] = [
  { id: 'early_bird', kode: 'early_bird', nama: 'Early Bird', tanggal_mulai: '2026-11-16', tanggal_selesai: '2026-11-28' },
  { id: 'reguler', kode: 'reguler', nama: 'Reguler', tanggal_mulai: '2026-11-29', tanggal_selesai: '2026-12-12' },
  { id: 'last_minute', kode: 'last_minute', nama: 'Last Minute', tanggal_mulai: '2026-12-13', tanggal_selesai: '2026-12-19' },
]

export async function getPeriodeHarga(): Promise<PeriodeHarga[]> {
  const { data } = await supabaseAdmin.from('pengaturan_umum').select('value').eq('key', 'periode_harga').maybeSingle()
  if (data?.value) {
    try {
      const parsed = JSON.parse(data.value)
      if (Array.isArray(parsed)) {
        return (parsed as PeriodeHarga[]).sort((a, b) => a.tanggal_mulai.localeCompare(b.tanggal_mulai))
      }
    } catch {
      // Data rusak, pakai default.
    }
  }
  return DEFAULT_PERIODE
}

async function simpanPeriodeHarga(list: PeriodeHarga[]) {
  const { error } = await supabaseAdmin
    .from('pengaturan_umum')
    .upsert({ key: 'periode_harga', value: JSON.stringify(list), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export async function upsertPeriodeHarga(payload: Partial<PeriodeHarga>) {
  const list = await getPeriodeHarga()
  if (payload.id) {
    const item = list.find((p) => p.id === payload.id)
    if (!item) throw new Error('Periode tidak ditemukan')
    Object.assign(item, payload)
    await simpanPeriodeHarga(list)
    return item
  }
  const item: PeriodeHarga = {
    id: randomUUID(),
    kode: payload.kode ?? randomUUID(),
    nama: payload.nama ?? '',
    tanggal_mulai: payload.tanggal_mulai ?? '',
    tanggal_selesai: payload.tanggal_selesai ?? '',
  }
  list.push(item)
  await simpanPeriodeHarga(list)
  return item
}

export async function deletePeriodeHarga(id: string) {
  const list = await getPeriodeHarga()
  const item = list.find((p) => p.id === id)
  if (!item) throw new Error('Periode tidak ditemukan')
  if (item.kode) {
    const { error } = await supabaseAdmin.from('harga_dasar').delete().eq('periode', item.kode)
    if (error) throw error
  }
  await simpanPeriodeHarga(list.filter((p) => p.id !== id))
}

// ─── Faktor Harga ─────────────────────────────────────────────────────────────

export async function getFaktorHarga(): Promise<FaktorHarga[]> {
  const { data, error } = await supabaseAdmin.from('faktor_harga').select('*').order('tipe')
  if (error) throw error
  return data ?? []
}

export async function upsertFaktorHarga(payload: Partial<FaktorHarga>) {
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('faktor_harga').update(payload).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('faktor_harga').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function deleteFaktorHarga(id: string) {
  const { error } = await supabaseAdmin.from('faktor_harga').delete().eq('id', id)
  if (error) throw error
}

// ─── Tenants ─────────────────────────────────────────────────────────────────

export async function getTenants(): Promise<Tenant[]> {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('*, kategori_sewa(kode, nama)')
    .order('kode_stand')
  if (error) throw error
  return (data ?? []) as Tenant[]
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('*, kategori_sewa(kode, nama)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createTenant(payload: Omit<Tenant, 'id' | 'sudah_dibayar' | 'kategori_sewa'>) {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .insert({ ...payload, sudah_dibayar: 0 })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTenant(id: string, payload: Partial<Omit<Tenant, 'kategori_sewa'>>) {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTenant(id: string) {
  const { error } = await supabaseAdmin.from('tenants').delete().eq('id', id)
  if (error) throw error
}

export async function syncTenantPaymentStatus(tenantId: string) {
  const { data: payments } = await supabaseAdmin
    .from('pembayaran').select('nominal,validated').eq('tenant_id', tenantId)

  const total = (payments ?? [])
    .filter((p: { validated: boolean }) => p.validated)
    .reduce((s: number, p: { nominal: number }) => s + Number(p.nominal), 0)

  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('harga_akhir, dp_wajib, tgl_acara, status')
    .eq('id', tenantId).single()

  if (!tenant) return

  let newStatus: string
  if (total >= Number(tenant.harga_akhir)) {
    newStatus = 'lunas'
  } else if (tenant.tgl_acara && new Date() > new Date(tenant.tgl_acara) && total < Number(tenant.harga_akhir)) {
    newStatus = 'menunggak'
  } else if (total > Number(tenant.dp_wajib)) {
    newStatus = 'cicil'
  } else if (total > 0) {
    newStatus = 'dp'
  } else {
    newStatus = 'daftar'
  }

  await supabaseAdmin
    .from('tenants')
    .update({ sudah_dibayar: total, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', tenantId)
}

// ─── Pembayaran ───────────────────────────────────────────────────────────────

export async function getPembayaran(tenantId?: string): Promise<Pembayaran[]> {
  let query = supabaseAdmin
    .from('pembayaran')
    .select('*, tenants(kode_stand, nama_usaha)')
    .order('tanggal_bayar', { ascending: false })
  if (tenantId) query = query.eq('tenant_id', tenantId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Pembayaran[]
}

export async function createPembayaran(payload: Omit<Pembayaran, 'id' | 'no_transaksi' | 'tenants'>) {
  const { count } = await supabaseAdmin
    .from('pembayaran').select('*', { count: 'exact', head: true })
  const no = `TRX-${String((count ?? 0) + 1).padStart(4, '0')}`

  const { data, error } = await supabaseAdmin
    .from('pembayaran').insert({ ...payload, no_transaksi: no }).select().single()
  if (error) throw error

  if (payload.validated) await syncTenantPaymentStatus(payload.tenant_id)
  return data
}

export async function deletePembayaran(id: string, tenantId: string) {
  const { error } = await supabaseAdmin.from('pembayaran').delete().eq('id', id)
  if (error) throw error
  await syncTenantPaymentStatus(tenantId)
}

// Magic-byte detection for images
function isImage(bytes: Buffer): boolean {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return true
  if (bytes.length >= 3 && bytes.toString('ascii', 0, 3) === 'GIF') return true
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return true
  return false
}

export async function uploadBuktiBayar(file: File, tenantId: string): Promise<string> {
  const raw = Buffer.from(await file.arrayBuffer()) as unknown as Buffer
  let uploadBytes: Buffer = raw
  let contentType = file.type.toLowerCase()
  let ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  if (isImage(raw)) {
    const result = await compressToWebp(raw, file.type.toLowerCase())
    uploadBytes = result.buffer as unknown as Buffer
    contentType = result.mimeType
    ext = result.mimeType === 'image/webp' ? 'webp' : (file.name.split('.').pop()?.toLowerCase() ?? 'bin')
  }
  const safeTenant = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '')
  const path = `bukti-bayar/${safeTenant}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabaseAdmin.storage
    .from('bukti')
    .upload(path, uploadBytes, { contentType, cacheControl: '31536000' })
  if (error) throw error
  const { data } = supabaseAdmin.storage.from('bukti').getPublicUrl(path)
  return data.publicUrl
}

// ─── Merchandise ─────────────────────────────────────────────────────────────

export async function getMerchandise(onlyAktif = false): Promise<Merchandise[]> {
  let query = supabaseAdmin.from('merchandise').select('*').order('nama')
  if (onlyAktif) query = query.eq('aktif', true)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function upsertMerchandise(payload: Partial<Merchandise>) {
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('merchandise').update(payload).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('merchandise').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function deleteMerchandise(id: string) {
  const { error } = await supabaseAdmin.from('merchandise').delete().eq('id', id)
  if (error) throw error
}

const MERCH_MODAL_FIELDS = ['nama', 'harga', 'harga_pengurus_pendek', 'harga_pengurus_panjang', 'harga_umum_pendek', 'harga_umum_panjang', 'urutan'] as const

export async function getMerchModalItem(): Promise<MerchModalItem[]> {
  const { data, error } = await supabaseAdmin.from('merch_modal_item').select('*').order('urutan').order('nama')
  if (error) throw error
  return (data ?? []) as MerchModalItem[]
}

export async function upsertMerchModalItem(payload: Partial<MerchModalItem>) {
  const fields = pickFields(payload as Record<string, unknown>, MERCH_MODAL_FIELDS)
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('merch_modal_item').update(fields).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('merch_modal_item').insert(fields).select().single()
  if (error) throw error
  return data
}

export async function deleteMerchModalItem(id: string) {
  const { error } = await supabaseAdmin.from('merch_modal_item').delete().eq('id', id)
  if (error) throw error
}

// ─── Ticket ──────────────────────────────────────────────────────────────────

const TICKET_FIELDS = ['nama', 'deskripsi', 'thumbnail_url', 'harga', 'jumlah_orang', 'kuota', 'urutan', 'aktif', 'is_hari_h', 'mulai_jual', 'selesai_jual'] as const
const TICKET_PERIODE_FIELDS = ['tiket_tipe_id', 'nama', 'tanggal_mulai', 'tanggal_selesai', 'harga', 'urutan'] as const
const TICKET_BUNDLE_FIELDS = ['tiket_tipe_id', 'jumlah_min', 'diskon_persen', 'urutan'] as const
const TICKET_MODAL_FIELDS = ['nama', 'harga', 'urutan'] as const

function pickFields<T extends Record<string, unknown>>(obj: T, fields: readonly string[]) {
  const out: Record<string, unknown> = {}
  for (const key of fields) {
    if (key in obj) out[key] = obj[key]
  }
  return out
}

export async function getTicket(onlyAktif = false): Promise<Ticket[]> {
  let query = supabaseAdmin.from('tiket_tipe').select('*').order('urutan').order('nama')
  if (onlyAktif) query = query.eq('aktif', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Ticket[]
}

export async function upsertTicket(payload: Partial<Ticket>) {
  const fields = pickFields(payload as Record<string, unknown>, TICKET_FIELDS)
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('tiket_tipe').update(fields).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('tiket_tipe').insert(fields).select().single()
  if (error) throw error
  return data
}

export async function deleteTicket(id: string) {
  const { error } = await supabaseAdmin.from('tiket_tipe').delete().eq('id', id)
  if (error) throw error
}

export async function getTicketPeriode(tipeId?: string): Promise<TicketPeriode[]> {
  let query = supabaseAdmin.from('tiket_periode').select('*').order('tanggal_mulai').order('urutan')
  if (tipeId) query = query.eq('tiket_tipe_id', tipeId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as TicketPeriode[]
}

export async function upsertTicketPeriode(payload: Partial<TicketPeriode>) {
  const fields = pickFields(payload as Record<string, unknown>, TICKET_PERIODE_FIELDS)
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('tiket_periode').update(fields).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('tiket_periode').insert(fields).select().single()
  if (error) throw error
  return data
}

export async function deleteTicketPeriode(id: string) {
  const { error } = await supabaseAdmin.from('tiket_periode').delete().eq('id', id)
  if (error) throw error
}

export async function getTicketBundleDiscount(tipeId?: string): Promise<TicketBundleDiscount[]> {
  let query = supabaseAdmin.from('tiket_bundle_discount').select('*').order('urutan').order('jumlah_min')
  if (tipeId) query = query.eq('tiket_tipe_id', tipeId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as TicketBundleDiscount[]
}

export async function upsertTicketBundleDiscount(payload: Partial<TicketBundleDiscount>) {
  const fields = pickFields(payload as Record<string, unknown>, TICKET_BUNDLE_FIELDS)
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('tiket_bundle_discount').update(fields).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('tiket_bundle_discount').insert(fields).select().single()
  if (error) throw error
  return data
}

export async function deleteTicketBundleDiscount(id: string) {
  const { error } = await supabaseAdmin.from('tiket_bundle_discount').delete().eq('id', id)
  if (error) throw error
}

export async function getTicketModalItem(): Promise<TicketModalItem[]> {
  const { data, error } = await supabaseAdmin.from('tiket_modal_item').select('*').order('urutan').order('nama')
  if (error) throw error
  return (data ?? []) as TicketModalItem[]
}

export async function upsertTicketModalItem(payload: Partial<TicketModalItem>) {
  const fields = pickFields(payload as Record<string, unknown>, TICKET_MODAL_FIELDS)
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('tiket_modal_item').update(fields).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('tiket_modal_item').insert(fields).select().single()
  if (error) throw error
  return data
}

export async function deleteTicketModalItem(id: string) {
  const { error } = await supabaseAdmin.from('tiket_modal_item').delete().eq('id', id)
  if (error) throw error
}

export async function getTicketKatalog(): Promise<TicketKatalogItem[]> {
  const [tipeRes, periodeRes, pendingRes, bundleRes] = await Promise.all([
    supabaseAdmin.from('tiket_tipe').select('*').order('urutan').order('nama'),
    supabaseAdmin.from('tiket_periode').select('*').order('tanggal_mulai').order('urutan'),
    supabaseAdmin.from('pesanan_tiket').select('tiket_tipe_id,jumlah').eq('status', 'menunggu_verifikasi'),
    supabaseAdmin.from('tiket_bundle_discount').select('*').order('urutan').order('jumlah_min'),
  ])
  if (tipeRes.error) throw tipeRes.error
  if (periodeRes.error) throw periodeRes.error
  if (pendingRes.error) throw pendingRes.error
  if (bundleRes.error) throw bundleRes.error

  const periods = (periodeRes.data ?? []) as TicketPeriode[]
  const bundles = (bundleRes.data ?? []) as TicketBundleDiscount[]
  const pending = new Map<string, number>()
  for (const row of (pendingRes.data ?? []) as { tiket_tipe_id: string | null; jumlah: number | null }[]) {
    if (!row.tiket_tipe_id) continue
    pending.set(row.tiket_tipe_id, (pending.get(row.tiket_tipe_id) ?? 0) + Number(row.jumlah ?? 0))
  }

  const today = todayISO()
  const now = new Date()
  return ((tipeRes.data ?? []) as Ticket[]).map((t) => {
    const periode = periods.find(
      (p) => p.tiket_tipe_id === t.id && today >= p.tanggal_mulai && today <= p.tanggal_selesai
    ) ?? null
    const pendingQty = pending.get(t.id) ?? 0
    const kuota = Number(t.kuota ?? 0)
    const sisa = kuota > 0 ? Math.max(0, kuota - Number(t.terjual ?? 0) - pendingQty) : null
    const buka =
      t.aktif &&
      (!t.mulai_jual || now >= new Date(t.mulai_jual)) &&
      (!t.selesai_jual || now <= new Date(t.selesai_jual)) &&
      (sisa === null || sisa > 0)
    return {
      ...t,
      harga_aktif: Number(periode?.harga ?? t.harga),
      periode_aktif: periode,
      periode: periods.filter((p) => p.tiket_tipe_id === t.id),
      pending: pendingQty,
      sisa,
      buka,
      bundle_discounts: bundles.filter((b) => b.tiket_tipe_id === t.id),
    }
  })
}

export async function getTicketPenjualan(): Promise<PesananTiket[]> {
  const [pesananRes, tipeRes, periodeRes, modalRes] = await Promise.all([
    supabaseAdmin.from('pesanan_tiket').select('*').order('created_at', { ascending: false }),
    supabaseAdmin.from('tiket_tipe').select('id,nama'),
    supabaseAdmin.from('tiket_periode').select('*').order('tanggal_mulai').order('urutan'),
    supabaseAdmin.from('tiket_modal_item').select('harga'),
  ])
  if (pesananRes.error) throw pesananRes.error
  if (tipeRes.error) throw tipeRes.error
  if (periodeRes.error) throw periodeRes.error
  if (modalRes.error) throw modalRes.error

  const tipeById = new Map<string, string>()
  for (const t of (tipeRes.data ?? []) as { id: string; nama: string }[]) {
    tipeById.set(t.id, t.nama)
  }
  const periods = (periodeRes.data ?? []) as TicketPeriode[]
  const modalSatuan = ((modalRes.data ?? []) as { harga: number | null }[]).reduce(
    (sum, item) => sum + Number(item.harga ?? 0),
    0
  )

  return ((pesananRes.data ?? []) as Record<string, unknown>[]).map((row) => {
    const tipeId = row.tiket_tipe_id ? String(row.tiket_tipe_id) : null
    const createdAt = row.created_at ? new Date(String(row.created_at)) : null
    const tanggal = createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      : ''
    const periode = tipeId
      ? periods.find((p) => p.tiket_tipe_id === tipeId && tanggal >= p.tanggal_mulai && tanggal <= p.tanggal_selesai)
      : undefined
    const jumlah = Number(row.jumlah ?? 0)
    return {
      ...row,
      tiket_nama: tipeId ? tipeById.get(tipeId) ?? null : null,
      periode_nama: periode?.nama ?? null,
      harga_satuan: Number(row.harga_satuan ?? 0),
      diskon_persen: row.diskon_persen == null ? null : Number(row.diskon_persen),
      modal_satuan: modalSatuan,
      modal_total: modalSatuan * jumlah,
      keuntungan: Number(row.total ?? 0) - modalSatuan * jumlah,
    } as PesananTiket
  })
}

export async function getStrukTiket(noPesanan: string) {
  const { data: pesanan } = await supabaseAdmin
    .from('pesanan_tiket')
    .select('*')
    .eq('no_pesanan', noPesanan)
    .maybeSingle()
  if (!pesanan) return null

  const [{ data: tipe }, { data: periodeList }] = await Promise.all([
    pesanan.tiket_tipe_id
      ? supabaseAdmin.from('tiket_tipe').select('nama').eq('id', pesanan.tiket_tipe_id).maybeSingle()
      : Promise.resolve({ data: null }),
    pesanan.tiket_tipe_id
      ? supabaseAdmin.from('tiket_periode').select('*').eq('tiket_tipe_id', pesanan.tiket_tipe_id)
      : Promise.resolve({ data: [] }),
  ])

  const created = pesanan.created_at ? new Date(String(pesanan.created_at)) : null
  const tanggal = created && !Number.isNaN(created.getTime())
    ? created.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
    : ''
  const periode = ((periodeList ?? []) as TicketPeriode[]).find(
    (p) => tanggal >= p.tanggal_mulai && tanggal <= p.tanggal_selesai
  )

  return {
    no_pesanan: String(pesanan.no_pesanan),
    nama_pembeli: String(pesanan.nama_pembeli),
    kontak: String(pesanan.kontak),
    email: pesanan.email ? String(pesanan.email) : null,
    jumlah: Number(pesanan.jumlah),
    harga_satuan: Number(pesanan.harga_satuan),
    diskon_persen: pesanan.diskon_persen ? Number(pesanan.diskon_persen) : null,
    total: Number(pesanan.total),
    status: String(pesanan.status),
    created_at: String(pesanan.created_at),
    tiket_nama: tipe?.nama ? String(tipe.nama) : null,
    periode_nama: periode?.nama ?? null,
  }
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export async function createAuditLog(payload: {
  aksi: string
  target_type?: string
  target_id?: string
  data_lama?: object | null
  data_baru?: object | null
  user_name?: string | null
}) {
  try {
    const headerStore = await headers()
    const session = await getSessionUser()

    const userAgent = headerStore.get('user-agent')
    const { user_name: overrideName, ...basePayload } = payload
    const fullPayload = {
      ...basePayload,
      user_name: overrideName ?? session?.name ?? null,
      location: requestLocation(headerStore),
      ip_address: requestIp(headerStore),
      user_agent: userAgent,
    }

    // ponytail: metadata columns need migration 030; fall back so old DBs keep logging.
    supabaseAdmin.from('audit_log').insert(fullPayload).then(({ error }) => {
      if (error) supabaseAdmin.from('audit_log').insert(basePayload).then()
    })
  } catch {
    // Audit logging must never block the user action.
  }
}

export async function getAuditLog(limit = 1000) {
  const { data, error } = await supabaseAdmin
    .from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data ?? []
}

// ─── Laporan ─────────────────────────────────────────────────────────────────

export async function getLaporanTenants() {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('kode_stand, nama_usaha, jenis_usaha, asal, lokasi, periode_daftar, harga_akhir, dp_wajib, sudah_dibayar, status, tgl_daftar, tgl_dp, kategori_sewa(kode, nama)')
    .neq('status', 'batal')
    .order('kode_stand')
  if (error) throw error
  return data ?? []
}

export async function getRekapKeuangan() {
  const { data } = await supabaseAdmin
    .from('tenants').select('harga_akhir, sudah_dibayar, status').neq('status', 'batal')
  const all = data ?? []
  const totalTagihan = all.reduce((s: number, t: { harga_akhir: number }) => s + t.harga_akhir, 0)
  const totalMasuk = all.reduce((s: number, t: { sudah_dibayar: number }) => s + t.sudah_dibayar, 0)
  return {
    totalTagihan,
    totalMasuk,
    totalPiutang: totalTagihan - totalMasuk,
    countLunas: all.filter((t: { status: string }) => t.status === 'lunas').length,
    countMenunggak: all.filter((t: { status: string }) => t.status === 'menunggak').length,
    countAktif: all.length,
  }
}
