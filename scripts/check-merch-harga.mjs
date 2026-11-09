import assert from 'node:assert/strict'
import { hargaUntuk, hargaMulai, opsiLengan } from '../src/lib/merch-harga.ts'

const produk = {
  harga: 100,
  harga_po: 80,
  harga_po_panjang: 90,
  harga_po_umum: 0,
  harga_po_umum_panjang: 0,
  harga_hari_h_panjang: 120,
}

assert.deepEqual(opsiLengan(produk, 'po'), ['Pendek', 'Panjang'])
assert.deepEqual(opsiLengan(produk, 'po', 'Umum'), ['Pendek', 'Panjang'])
assert.deepEqual(opsiLengan(produk, 'po', 'Pengurus Himpunan'), ['Pendek', 'Panjang'])
assert.equal(hargaUntuk(produk, 'Umum', 'Pendek', 'po'), 80)
assert.equal(hargaUntuk(produk, 'Umum', 'Panjang', 'po'), 90)
assert.equal(hargaUntuk(produk, 'Pengurus Himpunan', 'Panjang', 'po'), 90)
assert.equal(hargaUntuk(produk, 'Umum', 'Pendek', 'hari_h'), 100)
assert.equal(hargaUntuk(produk, 'Umum', 'Panjang', 'hari_h'), 120)
assert.equal(hargaMulai(produk, 'Umum', 'po'), 80)

const umumOnly = { ...produk, harga_po: 0, harga_po_panjang: 0, harga_po_umum: 70, harga_po_umum_panjang: 0 }
assert.deepEqual(opsiLengan(umumOnly, 'po', 'Pengurus Himpunan'), [])
assert.deepEqual(opsiLengan(umumOnly, 'po', 'Umum'), ['Pendek'])
assert.equal(hargaMulai(umumOnly, 'Pengurus Himpunan', 'po'), 0)

console.log('merch-harga OK')
