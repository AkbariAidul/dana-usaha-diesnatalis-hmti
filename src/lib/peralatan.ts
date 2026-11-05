import { supabaseAdmin } from './supabase'
import type { KomposisiPeralatan } from './types'

export type PeralatanMeta = Record<string, { harga_satuan: number; harga_sewa?: number; vendor: string }>

const META_KEY = 'peralatan_meta'
const KOMPOSISI_KEY = 'kategori_peralatan'

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await supabaseAdmin.from('pengaturan_umum').select('value').eq('key', key).maybeSingle()
  if (!data?.value) return fallback
  try {
    return JSON.parse(data.value) as T
  } catch {
    return fallback
  }
}

async function saveSetting(key: string, value: unknown) {
  const { error } = await supabaseAdmin
    .from('pengaturan_umum')
    .upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export function getPeralatanMeta() {
  return getSetting<PeralatanMeta>(META_KEY, {})
}

export function savePeralatanMeta(meta: PeralatanMeta) {
  return saveSetting(META_KEY, meta)
}

export function getKomposisiPeralatan() {
  return getSetting<KomposisiPeralatan>(KOMPOSISI_KEY, {})
}

export function saveKomposisiPeralatan(komposisi: KomposisiPeralatan) {
  return saveSetting(KOMPOSISI_KEY, komposisi)
}
