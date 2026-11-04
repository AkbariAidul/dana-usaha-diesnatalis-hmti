type StrukItem = {
  nama: string
  ukuran: string | null
  qty: number
  subtotal: number
}

type StrukPo = {
  no_po: string
  nama_pemesan: string
  tipe_pemesan: string
  kontak: string
  total: number
  sudah_dibayar: number | null
  pembayaran_metode: string | null
  pembayaran_tipe: string | null
  status: string
  created_at: string
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function tanggal(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export function namaFileStruk(noPo: string) {
  return `struk-${noPo}.xls`
}

export function buatStrukPoHtml(po: StrukPo, items: StrukItem[]) {
  const dibayar = Number(po.sudah_dibayar ?? 0)
  const total = Number(po.total)
  const sisa = Math.max(0, total - dibayar)
  const rows = items
    .map(
      (item) => `<tr>
        <td>${esc(item.nama)}</td>
        <td>${esc(item.ukuran || '-')}</td>
        <td>${Number(item.qty)}</td>
        <td>${Number(item.subtotal)}</td>
      </tr>`
    )
    .join('')

  return `<html><head><meta charset="utf-8"><style>
    td, th { border: 1px solid #cbd5e1; padding: 5px 8px; font-family: Arial, sans-serif; font-size: 11pt; }
    th { background: #f1f5f9; text-align: left; }
    .label { width: 150px; font-weight: bold; }
    .angka { text-align: right; }
  </style></head><body>
    <table>
      <tr><th colspan="4" style="font-size:14pt">STRUK PRE-ORDER MERCHANDISE</th></tr>
      <tr><td class="label">No. PO</td><td colspan="3">${esc(po.no_po)}</td></tr>
      <tr><td class="label">Nama Pemesan</td><td colspan="3">${esc(po.nama_pemesan)}</td></tr>
      <tr><td class="label">Kategori</td><td colspan="3">${esc(po.tipe_pemesan)}</td></tr>
      <tr><td class="label">Kontak</td><td colspan="3">${esc(po.kontak)}</td></tr>
      <tr><td class="label">Tanggal PO</td><td colspan="3">${esc(tanggal(po.created_at))}</td></tr>
      <tr><td class="label">Status</td><td colspan="3">${esc(po.status.replace(/_/g, ' '))}</td></tr>
      <tr><td class="label">Pembayaran</td><td colspan="3">${esc(po.pembayaran_metode || '-')} · ${esc(po.pembayaran_tipe === 'nyicil' ? 'Nyicil' : 'Lunas')}</td></tr>
      <tr><th>Produk</th><th>Ukuran</th><th>Qty</th><th>Subtotal (Rp)</th></tr>
      ${rows}
      <tr><td colspan="3" class="angka"><b>Total</b></td><td class="angka">${total}</td></tr>
      <tr><td colspan="3" class="angka"><b>Sudah Dibayar</b></td><td class="angka">${dibayar}</td></tr>
      <tr><td colspan="3" class="angka"><b>Sisa</b></td><td class="angka">${sisa}</td></tr>
    </table>
  </body></html>`
}
