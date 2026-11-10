// Uji cepat RPC dari migrasi 047_atomic_orders.sql.
// Jalankan: npm run check:rpc
// Tidak menulis data permanen: order uji dihapus lagi di akhir.

import { randomUUID } from 'node:crypto'

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!rawUrl || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi (.env.local).')
  process.exit(1)
}

const base = rawUrl.replace(/\/+$/, '').replace(/\/rest\/v1$/, '')
const rest = `${base}/rest/v1`
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
}

let failed = 0
function assert(ok, label, detail = '') {
  if (ok) {
    console.log(`ok   - ${label}`)
  } else {
    failed++
    console.error(`FAIL - ${label}${detail ? ` (${detail})` : ''}`)
  }
}

async function parse(res) {
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    const msg = body?.message ?? body?.error_description ?? String(body ?? res.statusText)
    const err = new Error(msg)
    err.code = body?.code
    throw err
  }
  return body
}

const rpc = (fn, args) =>
  fetch(`${rest}/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) }).then(parse)

const select = (table, query) => fetch(`${rest}/${table}?${query}`, { headers }).then(parse)

const remove = (table, query) =>
  fetch(`${rest}/${table}?${query}`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=minimal' },
  }).then(parse)

async function expectRpcError(fn, args, expected) {
  try {
    await rpc(fn, args)
    assert(false, `${fn} menolak input tidak valid`, 'tidak ada error')
  } catch (err) {
    assert(
      String(err.message).includes(expected),
      `${fn} menolak input tidak valid`,
      err.message
    )
  }
}

async function checkCounter() {
  const first = await rpc('next_order_number', { p_prefix: 'ZZ', p_pad: 4 })
  const second = await rpc('next_order_number', { p_prefix: 'ZZ', p_pad: 4 })
  const n1 = Number(String(first).split('-')[1])
  const n2 = Number(String(second).split('-')[1])
  assert(/^ZZ-\d{4,}$/.test(first), 'next_order_number memformat nomor', first)
  assert(n2 === n1 + 1, 'next_order_number menaikkan counter', `${first} -> ${second}`)
  await remove('order_counter', 'prefix=eq.ZZ')
}

async function checkIdempotency() {
  const tipe = await select('tiket_tipe', 'select=id&limit=1')
  if (!tipe?.length) {
    console.log('skip - tidak ada tiket_tipe untuk uji idempotensi')
    return
  }

  const idempotency_key = randomUUID()
  const payload = {
    tiket_tipe_id: tipe[0].id,
    nama_pembeli: 'Check RPC',
    kontak: '000',
    jumlah: 1,
    harga_satuan: 0,
    total: 0,
    idempotency_key,
  }

  let created
  try {
    created = await rpc('create_tiket_order', { p_payload: payload })
  } catch (err) {
    if (/Sisa tiket/i.test(err.message)) {
      console.log('skip - kuota tiket habis')
      return
    }
    throw err
  }

  try {
    assert(/^TK-\d+$/.test(created.order?.no_pesanan ?? ''), 'create_tiket_order membuat nomor TK', created.order?.no_pesanan)
    assert(created.existing === false, 'create_tiket_order menandai order baru')

    const again = await rpc('create_tiket_order', { p_payload: payload })
    assert(again.existing === true, 'create_tiket_order idempoten (existing=true)')
    assert(again.order?.id === created.order?.id, 'idempotensi mengembalikan order yang sama')
  } finally {
    await remove('pesanan_tiket', `id=eq.${created.order.id}`)
  }
}

async function main() {
  await checkCounter()

  const missing = '00000000-0000-0000-0000-000000000000'
  await expectRpcError('create_tiket_order', { p_payload: { tiket_tipe_id: missing } }, 'Tipe tiket tidak ditemukan')
  await expectRpcError('create_po_order', { p_payload: { items: [] } }, 'Pilih minimal satu produk')
  await expectRpcError('create_bundle_order', { p_payload: { bundle_id: missing } }, 'Paket tidak ditemukan')
  await expectRpcError('create_tenant_order', { p_payload: { kategori_sewa_id: missing } }, 'Kategori sewa tidak ditemukan')

  await checkIdempotency()

  if (failed > 0) {
    console.error(`\n${failed} check gagal.`)
    process.exit(1)
  }
  console.log('\nSemua check RPC lulus.')
}

main().catch((err) => {
  console.error('Check RPC error:', err.message)
  process.exit(1)
})
