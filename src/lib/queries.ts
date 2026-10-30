import { supabase, supabaseAdmin } from './supabase'
import type { Tenant, Pembayaran, KategoriSewa, HargaDasar, FaktorHarga, Acara, Merchandise, Ticket } from './types'

// ─── Acara ───────────────────────────────────────────────────────────────────

export async function getAcara(): Promise<Acara | null> {
  const { data } = await supabase.from('acara').select('*').limit(1).maybeSingle()
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
  const { data, error } = await supabase.from('kategori_sewa').select('*').order('kode')
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

// ─── Harga Dasar ─────────────────────────────────────────────────────────────

export async function getHargaDasar(): Promise<HargaDasar[]> {
  const { data, error } = await supabase.from('harga_dasar').select('*')
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

// ─── Faktor Harga ─────────────────────────────────────────────────────────────

export async function getFaktorHarga(): Promise<FaktorHarga[]> {
  const { data, error } = await supabase.from('faktor_harga').select('*').order('tipe')
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
  const { data, error } = await supabase
    .from('tenants')
    .select('*, kategori_sewa(kode, nama)')
    .order('kode_stand')
  if (error) throw error
  return (data ?? []) as Tenant[]
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const { data, error } = await supabase
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
    .from('pembayaran').select('nominal').eq('tenant_id', tenantId)

  const total = (payments ?? []).reduce((s: number, p: { nominal: number }) => s + p.nominal, 0)

  const { data: tenant } = await supabaseAdmin
    .from('tenants').select('harga_akhir, dp_wajib, tgl_acara, status')
    .eq('id', tenantId).single()

  if (!tenant) return

  let newStatus: string
  if (total >= tenant.harga_akhir) {
    newStatus = 'lunas'
  } else if (tenant.tgl_acara && new Date() > new Date(tenant.tgl_acara) && total < tenant.harga_akhir) {
    newStatus = 'menunggak'
  } else if (total >= tenant.dp_wajib) {
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
  let query = supabase
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

  await syncTenantPaymentStatus(payload.tenant_id)
  return data
}

export async function deletePembayaran(id: string, tenantId: string) {
  const { error } = await supabaseAdmin.from('pembayaran').delete().eq('id', id)
  if (error) throw error
  await syncTenantPaymentStatus(tenantId)
}

export async function uploadBuktiBayar(file: File, tenantId: string): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `bukti/${tenantId}/${Date.now()}.${ext}`
  const { error } = await supabaseAdmin.storage
    .from('pembayaran-bukti')
    .upload(path, file, { contentType: file.type })
  if (error) throw error
  const { data } = supabaseAdmin.storage.from('pembayaran-bukti').getPublicUrl(path)
  return data.publicUrl
}

// ─── Merchandise ─────────────────────────────────────────────────────────────

export async function getMerchandise(onlyAktif = false): Promise<Merchandise[]> {
  let query = supabase.from('merchandise').select('*').order('nama')
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

// ─── Ticket ──────────────────────────────────────────────────────────────────

export async function getTicket(onlyAktif = false): Promise<Ticket[]> {
  let query = supabase.from('ticket').select('*').order('harga')
  if (onlyAktif) query = query.eq('aktif', true)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function upsertTicket(payload: Partial<Ticket>) {
  if (payload.id) {
    const { data, error } = await supabaseAdmin
      .from('ticket').update(payload).eq('id', payload.id).select().single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabaseAdmin.from('ticket').insert(payload).select().single()
  if (error) throw error
  return data
}

export async function deleteTicket(id: string) {
  const { error } = await supabaseAdmin.from('ticket').delete().eq('id', id)
  if (error) throw error
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export async function createAuditLog(payload: {
  aksi: string
  target_type?: string
  target_id?: string
  data_lama?: object | null
  data_baru?: object | null
}) {
  // Non-blocking
  supabaseAdmin.from('audit_log').insert(payload).then()
}

export async function getAuditLog(limit = 100) {
  const { data, error } = await supabase
    .from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return data ?? []
}

// ─── Laporan ─────────────────────────────────────────────────────────────────

export async function getLaporanTenants() {
  const { data, error } = await supabase
    .from('tenants')
    .select('kode_stand, nama_usaha, jenis_usaha, asal, lokasi, periode_daftar, harga_akhir, dp_wajib, sudah_dibayar, status, tgl_daftar, tgl_dp, kategori_sewa(kode, nama)')
    .neq('status', 'batal')
    .order('kode_stand')
  if (error) throw error
  return data ?? []
}

export async function getRekapKeuangan() {
  const { data } = await supabase
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
