import { promises as fs } from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'

type InvoiceLine = {
  nama: string
  detail?: string | null
  qty: number
  harga_satuan: number
  subtotal: number
}

type InvoiceTotal = {
  label: string
  value: number
  highlight?: boolean
  big?: boolean
}

type InvoiceMeta = [label: string, value: string, label2: string, value2: string]

const UNGU = 'FF7C3AED'
const UNGU_MUDA = 'FFF5F3FF'
const ABU = 'FFF8FAFC'
const GARIS = 'FFE2E8F0'

function waktu(value: string) {
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

function border(cell: ExcelJS.Cell, color = GARIS) {
  cell.border = {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } },
  }
}

export function namaFileStruk(noInvoice: string) {
  return `invoice-${noInvoice}.xlsx`
}

async function buatInvoiceXlsx({
  jenis,
  noInvoice,
  meta,
  detailHeader,
  lines,
  totals,
  note,
}: {
  jenis: string
  noInvoice: string
  meta: InvoiceMeta[]
  detailHeader: string
  lines: InvoiceLine[]
  totals: InvoiceTotal[]
  note: string
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Dana Usaha HMTI'
  wb.created = new Date()

  const ws = wb.addWorksheet('Invoice', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  })
  ws.columns = [{ width: 10 }, { width: 28 }, { width: 16 }, { width: 8 }, { width: 16 }, { width: 18 }]

  try {
    const logo = await fs.readFile(path.join(process.cwd(), 'public', 'logo-dies-struk.png'))
    const logoBuffer = logo.buffer.slice(logo.byteOffset, logo.byteOffset + logo.byteLength) as ArrayBuffer
    const logoId = wb.addImage({ buffer: logoBuffer, extension: 'png' })
    ws.addImage(logoId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 66, height: 66 } })
  } catch {
    // logo opsional; struk tetap dibuat tanpa logo
  }

  ws.getRow(1).height = 24
  ws.getRow(2).height = 18
  ws.getRow(3).height = 18
  ws.getRow(4).height = 4

  ws.mergeCells('B1:F1')
  ws.getCell('B1').value = 'DANA USAHA HMTI'
  ws.getCell('B1').font = { bold: true, size: 18, color: { argb: UNGU } }
  ws.getCell('B1').alignment = { horizontal: 'center', vertical: 'middle' }
  ws.mergeCells('B2:F2')
  ws.getCell('B2').value = 'In4Days XI · Merchandise & Ticket'
  ws.getCell('B2').font = { size: 10, color: { argb: 'FF64748B' } }
  ws.getCell('B2').alignment = { horizontal: 'center', vertical: 'middle' }
  ws.mergeCells('B3:F3')
  ws.getCell('B3').value = jenis
  ws.getCell('B3').font = { bold: true, size: 11, color: { argb: 'FF0F172A' } }
  ws.getCell('B3').alignment = { horizontal: 'center', vertical: 'middle' }

  meta.forEach((row, index) => {
    const r = 5 + index
    ws.getRow(r).height = 18
    ws.mergeCells(`B${r}:C${r}`)
    ws.mergeCells(`D${r}:E${r}`)

    ws.getCell(`A${r}`).value = row[0]
    ws.getCell(`A${r}`).font = { size: 9, color: { argb: 'FF64748B' } }
    ws.getCell(`B${r}`).value = row[1]
    ws.getCell(`B${r}`).font = { bold: true, size: 10, color: { argb: 'FF0F172A' } }
    ws.getCell(`B${r}`).alignment = { vertical: 'middle' }

    ws.getCell(`D${r}`).value = row[2]
    ws.getCell(`D${r}`).font = { size: 9, color: { argb: 'FF64748B' } }
    ws.getCell(`D${r}`).alignment = { horizontal: 'right', vertical: 'middle' }
    ws.getCell(`F${r}`).value = row[3]
    ws.getCell(`F${r}`).font = { bold: true, size: 10, color: { argb: 'FF0F172A' } }
    ws.getCell(`F${r}`).alignment = { horizontal: 'right', vertical: 'middle' }
  })

  const headerRow = 10
  const headers = ['No', 'Item', detailHeader, 'Qty', 'Harga Satuan', 'Subtotal']
  headers.forEach((label, index) => {
    const cell = ws.getRow(headerRow).getCell(index + 1)
    cell.value = label
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: UNGU } }
    cell.alignment = { horizontal: index === 0 ? 'center' : index >= 3 ? 'right' : 'left', vertical: 'middle' }
    border(cell, UNGU)
  })
  ws.getRow(headerRow).height = 22

  lines.forEach((line, index) => {
    const r = headerRow + 1 + index
    const values = [index + 1, line.nama, line.detail || '-', Number(line.qty), Number(line.harga_satuan), Number(line.subtotal)]
    values.forEach((value, col) => {
      const cell = ws.getRow(r).getCell(col + 1)
      cell.value = value
      cell.font = { size: 10, color: { argb: 'FF0F172A' } }
      cell.alignment = { horizontal: col === 0 ? 'center' : col >= 3 ? 'right' : 'left', vertical: 'middle' }
      if (col >= 4) cell.numFmt = '"Rp" #,##0'
      border(cell)
      if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ABU } }
    })
    ws.getRow(r).height = 19
  })

  const totalStart = headerRow + lines.length + 1
  totals.forEach((total, index) => {
    const r = totalStart + index
    ws.mergeCells(`A${r}:D${r}`)
    ws.mergeCells(`E${r}:F${r}`)

    const labelCell = ws.getCell(`A${r}`)
    labelCell.value = total.label
    labelCell.font = { bold: total.highlight, size: 10, color: { argb: total.highlight ? 'FF4C1D95' : 'FF475569' } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    if (total.highlight) labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: UNGU_MUDA } }

    const valueCell = ws.getCell(`E${r}`)
    valueCell.value = total.value
    valueCell.numFmt = '"Rp" #,##0'
    valueCell.font = { bold: total.highlight, size: total.big ? 12 : 10, color: { argb: total.highlight ? 'FF4C1D95' : 'FF0F172A' } }
    valueCell.alignment = { horizontal: 'right', vertical: 'middle' }
    if (total.highlight) valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: UNGU_MUDA } }
    ws.getRow(r).height = total.big ? 24 : 19
  })

  const noteRow = totalStart + totals.length + 1
  ws.mergeCells(`A${noteRow}:F${noteRow}`)
  ws.getCell(`A${noteRow}`).value = note
  ws.getCell(`A${noteRow}`).font = { italic: true, size: 9, color: { argb: 'FF94A3B8' } }
  ws.getCell(`A${noteRow}`).alignment = { wrapText: true, vertical: 'top' }
  ws.getRow(noteRow).height = 32

  ws.pageSetup.printArea = `A1:F${noteRow}`
  ws.headerFooter.oddFooter = `&L${noInvoice}&R&Halaman &P dari &N`

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

type StrukItem = {
  nama: string
  ukuran: string | null
  qty: number
  harga_satuan: number
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

export async function buatStrukPoXlsx(po: StrukPo, items: StrukItem[]): Promise<Buffer> {
  const dibayar = Number(po.sudah_dibayar ?? 0)
  const total = Number(po.total)
  const sisa = Math.max(0, total - dibayar)

  return buatInvoiceXlsx({
    jenis: 'INVOICE PRE-ORDER',
    noInvoice: po.no_po,
    detailHeader: 'Ukuran',
    meta: [
      ['Nama', po.nama_pemesan, 'No. Invoice', po.no_po],
      ['Kontak', po.kontak, 'Tanggal', waktu(po.created_at)],
      ['Kategori', po.tipe_pemesan, 'Status', po.status === 'lunas' ? 'LUNAS' : po.status.replace(/_/g, ' ')],
      ['Bayar', `${po.pembayaran_metode || '-'} · ${po.pembayaran_tipe === 'nyicil' ? 'Nyicil' : 'Lunas'}`, 'Sisa Tagihan', `Rp ${sisa.toLocaleString('id-ID')}`],
    ],
    lines: items.map((item) => ({
      nama: item.nama,
      detail: item.ukuran,
      qty: Number(item.qty),
      harga_satuan: Number(item.harga_satuan),
      subtotal: Number(item.subtotal),
    })),
    totals: [
      { label: 'Subtotal', value: items.reduce((sum, item) => sum + Number(item.subtotal), 0) },
      { label: 'Total Tagihan', value: total, highlight: true, big: true },
      { label: 'Sudah Dibayar', value: dibayar },
      { label: 'Sisa Tagihan', value: sisa, highlight: true },
    ],
    note: 'Terima kasih telah melakukan pre-order merchandise Danus In4Days XI. Simpan invoice ini sebagai bukti pemesanan dan pengambilan.',
  })
}

type StrukTiket = {
  no_pesanan: string
  nama_pembeli: string
  kontak: string
  email: string | null
  jumlah: number
  harga_satuan: number
  diskon_persen: number | null
  total: number
  status: string
  created_at: string
  tiket_nama: string | null
  periode_nama: string | null
}

const STATUS_TIKET: Record<string, string> = {
  menunggu_verifikasi: 'Menunggu Verifikasi',
  lunas: 'LUNAS',
  ditolak: 'Ditolak',
  batal: 'Dibatalkan',
}

export async function buatStrukTiketXlsx(pesanan: StrukTiket): Promise<Buffer> {
  const jumlah = Number(pesanan.jumlah)
  const hargaSatuan = Number(pesanan.harga_satuan)
  const subtotal = jumlah * hargaSatuan
  const total = Number(pesanan.total)
  const diskon = Math.max(0, subtotal - total)
  const dibayar = pesanan.status === 'lunas' ? total : 0
  const sisa = Math.max(0, total - dibayar)

  return buatInvoiceXlsx({
    jenis: 'INVOICE TIKET',
    noInvoice: pesanan.no_pesanan,
    detailHeader: 'Periode',
    meta: [
      ['Nama', pesanan.nama_pembeli, 'No. Invoice', pesanan.no_pesanan],
      ['Kontak', pesanan.email ? `${pesanan.kontak} · ${pesanan.email}` : pesanan.kontak, 'Tanggal', waktu(pesanan.created_at)],
      ['Tipe Tiket', pesanan.tiket_nama || 'Tiket', 'Status', STATUS_TIKET[pesanan.status] ?? pesanan.status.replace(/_/g, ' ')],
      ['Periode', pesanan.periode_nama || 'Harga dasar', 'Total Tagihan', `Rp ${total.toLocaleString('id-ID')}`],
    ],
    lines: [
      {
        nama: pesanan.tiket_nama || 'Tiket',
        detail: pesanan.periode_nama || 'Harga dasar',
        qty: jumlah,
        harga_satuan: hargaSatuan,
        subtotal,
      },
    ],
    totals: [
      { label: 'Subtotal', value: subtotal },
      ...(diskon > 0 ? [{ label: 'Diskon', value: diskon }] : []),
      { label: 'Total Tagihan', value: total, highlight: true, big: true },
      { label: 'Sudah Dibayar', value: dibayar },
      { label: 'Sisa Tagihan', value: sisa, highlight: true },
    ],
    note: 'Terima kasih telah membeli tiket In4Days XI. Simpan invoice ini sebagai bukti pembelian. QR tiket dapat dilihat pada halaman riwayat pemesanan.',
  })
}
