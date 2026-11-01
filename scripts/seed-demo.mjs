import { createHmac, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diset')

const db = createClient(url, key, { auth: { persistSession: false } })
const cleanupOnly = process.argv.includes('--cleanup')
const today = new Date().toISOString().slice(0, 10)
const acara = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
const secret = process.env.PUBLIC_LINK_SECRET || key || 'dana-usaha-hmti-dev-secret'

const KONTAK = '081234567890'
const TENANT = 'TP-DEMO1'
const TIKET = 'TK-DEMO1'
const POS = ['PO-DEMO1', 'PO-DEMO2', 'PO-DEMO3']

function sign(tipe, kode) {
  return createHmac('sha256', secret).update(`${tipe}:${kode.toUpperCase()}`).digest('base64url')
}

function link(kode) {
  const tipe = kode.startsWith('TP-') ? 'tenant' : kode.startsWith('TK-') ? 'tiket' : 'po'
  return `/lacak/${kode}?t=${encodeURIComponent(sign(tipe, kode))}`
}

async function must(label, promise) {
  const { data, error } = await promise
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function cleanup() {
  await must('hapus pendaftaran demo', db.from('pendaftaran_tenant_pub').delete().eq('kode_pendaftaran', TENANT))
  await must('hapus tenant demo', db.from('tenants').delete().eq('kode_stand', TENANT))
  await must('hapus tiket demo', db.from('pesanan_tiket').delete().eq('no_pesanan', TIKET))
  await must('hapus PO demo', db.from('merch_po').delete().in('no_po', POS))
  await must('hapus pengurus demo', db.from('pengurus').delete().eq('nama', 'Demo Pengurus').eq('divisi', 'Acara'))
  console.log('Data demo lama dihapus.')
}

async function main() {
  await cleanup()
  if (cleanupOnly) return

  const kategori = (await must('ambil kategori', db.from('kategori_sewa').select('id').limit(1).maybeSingle()))?.id
  if (!kategori) throw new Error('kategori_sewa kosong')

  const { data: varianRows } = await must('ambil varian', db.from('merch_varian').select('id,nama'))
  const varian = Object.fromEntries((varianRows ?? []).map((v) => [v.nama, v.id]))
  for (const [i, nama] of ['S', 'M', 'L', 'XL', 'XXL'].entries()) {
    if (!varian[nama]) {
      const row = await must(`tambah varian ${nama}`, db.from('merch_varian').insert({ nama, urutan: i + 1 }).select('id').single())
      varian[nama] = row.id
    }
  }

  await must('tambah pendaftaran tenant', db.from('pendaftaran_tenant_pub').insert({
    kode_pendaftaran: TENANT,
    nama_usaha: 'Demo Tenant',
    kontak: KONTAK,
    kategori_sewa_id: kategori,
    jenis_usaha: 'F&B',
    asal: 'Internal Kampus',
    lokasi: 'Reguler',
    periode_daftar: 'reguler',
    harga_akhir: 400000,
    dp_wajib: 200000,
    sudah_dibayar: 320000,
    tgl_daftar: today,
    status: 'dp_diterima',
    alamat: 'Jl. Demo No. 1',
    deskripsi_usaha: 'Tenant contoh untuk smoke test',
    verified_by: 'Seed Demo',
    verified_at: new Date().toISOString(),
  }))

  const tenant = await must('tambah tenant', db.from('tenants').insert({
    kode_stand: TENANT,
    nama_usaha: 'Demo Tenant',
    kontak: KONTAK,
    kategori_sewa_id: kategori,
    jenis_usaha: 'F&B',
    asal: 'Internal Kampus',
    lokasi: 'Reguler',
    periode_daftar: 'reguler',
    harga_akhir: 400000,
    dp_wajib: 200000,
    sudah_dibayar: 320000,
    tgl_daftar: today,
    tgl_dp: today,
    tgl_acara: acara,
    status: 'cicil',
    keterangan: 'Data demo',
  }).select('id').single())

  await must('tambah pembayaran', db.from('pembayaran').insert([
    {
      tenant_id: tenant.id,
      no_transaksi: 'TRX-DEMO1A',
      tanggal_bayar: today,
      jenis: 'DP',
      nominal: 200000,
      metode: 'QRIS',
      dicatat_oleh: 'Seed Demo',
      keterangan: 'DP demo',
      validated: true,
    },
    {
      tenant_id: tenant.id,
      no_transaksi: 'TRX-DEMO1B',
      tanggal_bayar: today,
      jenis: 'Cicilan',
      nominal: 120000,
      metode: 'QRIS',
      dicatat_oleh: 'Seed Demo',
      keterangan: 'Cicilan demo (total 80%)',
      validated: true,
    },
    {
      tenant_id: tenant.id,
      no_transaksi: 'TRX-DEMO1C',
      tanggal_bayar: today,
      jenis: 'Cicilan',
      nominal: 50000,
      metode: 'QRIS',
      dicatat_oleh: 'Seed Demo',
      keterangan: 'Contoh pembayaran menunggu verifikasi',
      validated: false,
    },
  ]))

  let tipeTiket = (await must('ambil tipe tiket', db.from('tiket_tipe').select('id').eq('nama', 'Demo Tiket').maybeSingle()))?.id
  if (!tipeTiket) {
    tipeTiket = (await must('tambah tipe tiket', db.from('tiket_tipe').insert({
      nama: 'Demo Tiket',
      deskripsi: 'Tiket contoh smoke test',
      harga: 50000,
      kuota: 100,
      aktif: true,
    }).select('id').single())).id
  }

  const pesanan = await must('tambah pesanan tiket', db.from('pesanan_tiket').insert({
    no_pesanan: TIKET,
    nama_pembeli: 'Demo Tiket',
    kontak: KONTAK,
    tiket_tipe_id: tipeTiket,
    jumlah: 2,
    harga_satuan: 50000,
    total: 100000,
    status: 'lunas',
    verified_by: 'Seed Demo',
    verified_at: new Date().toISOString(),
  }).select('id').single())

  await must('tambah tiket issued', db.from('tiket_issued').insert([
    { pesanan_id: pesanan.id, kode_qr: randomUUID(), kode_tampil: 'TKT-DEMO-1', status: 'belum_divalidasi' },
    { pesanan_id: pesanan.id, kode_qr: randomUUID(), kode_tampil: 'TKT-DEMO-2', status: 'belum_divalidasi' },
  ]))

  const pengurus = await must('tambah pengurus', db.from('pengurus').insert({
    nama: 'Demo Pengurus',
    divisi: 'Acara',
    kontak: KONTAK,
    aktif: true,
  }).select('id').single())

  const po1 = await must('tambah PO pengurus', db.from('merch_po').insert({
    no_po: 'PO-DEMO1',
    nama_pemesan: 'Demo Pengurus',
    kontak: KONTAK,
    tipe_pemesan: 'Pengurus Himpunan',
    pengurus_id: pengurus.id,
    harga_per_item: 75000,
    total: 75000,
    sudah_dibayar: 75000,
    status: 'lunas',
    verified_by: 'Seed Demo',
    verified_at: new Date().toISOString(),
  }).select('id').single())

  await must('tambah item PO 1', db.from('merch_po_item').insert({
    po_id: po1.id,
    varian_id: varian.L,
    ukuran: 'L',
    qty: 1,
    harga_satuan: 75000,
    subtotal: 75000,
  }))

  const po2 = await must('tambah PO umum', db.from('merch_po').insert({
    no_po: 'PO-DEMO2',
    nama_pemesan: 'Demo Umum',
    kontak: KONTAK,
    tipe_pemesan: 'Umum',
    harga_per_item: 75000,
    total: 150000,
    sudah_dibayar: 150000,
    status: 'lunas',
    verified_by: 'Seed Demo',
    verified_at: new Date().toISOString(),
  }).select('id').single())

  await must('tambah item PO 2', db.from('merch_po_item').insert({
    po_id: po2.id,
    varian_id: varian.M,
    ukuran: 'M',
    qty: 2,
    harga_satuan: 75000,
    subtotal: 150000,
  }))

  const po3 = await must('tambah PO pending', db.from('merch_po').insert({
    no_po: 'PO-DEMO3',
    nama_pemesan: 'Demo Pending',
    kontak: KONTAK,
    tipe_pemesan: 'Umum',
    harga_per_item: 75000,
    total: 75000,
    sudah_dibayar: 0,
    status: 'menunggu_verifikasi',
  }).select('id').single())

  await must('tambah item PO 3', db.from('merch_po_item').insert({
    po_id: po3.id,
    varian_id: varian.S,
    ukuran: 'S',
    qty: 1,
    harga_satuan: 75000,
    subtotal: 75000,
  }))

  console.log('\nDummy data siap. Kontak semua: ' + KONTAK)
  console.log(`Tenant  ${TENANT}  ${link(TENANT)}`)
  console.log(`Tiket   ${TIKET}   ${link(TIKET)}`)
  for (const kode of POS) console.log(`PO      ${kode}   ${link(kode)}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
