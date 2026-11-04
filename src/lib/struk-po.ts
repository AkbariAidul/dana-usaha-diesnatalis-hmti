import { promises as fs } from 'fs'
import path from 'path'
import ExcelJS from 'exceljs'

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

export function namaFileStruk(noPo: string) {
  return `invoice-${noPo}.xlsx`
}

export async function buatStrukPoXlsx(po: StrukPo, items: StrukItem[]): Promise<Buffer> {
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
  ws.columns = [
    { width: 6 },
    { width: 32 },
    { width: 16 },
    { width: 8 },
    { width: 16 },
    { width: 18 },
  ]

  try {
    const logo = await fs.readFile(path.join(process.cwd(), 'public', 'logo-dies-struk.png'))
    const logoBuffer = logo.buffer.slice(logo.byteOffset, logo.byteOffset + logo.byteLength) as ArrayBuffer
    const logoId = wb.addImage({ buffer: logoBuffer, extension: 'png' })
    ws.addImage(logoId, { tl: { col: 0.15, row: 0.15 }, ext: { width: 76, height: 76 } })
  } catch {
    // logo opsional; struk tetap dibuat tanpa logo
  }

  ws.getRow(1).height = 26
  ws.getRow(2).height = 18
  ws.getRow(3).height = 18
  ws.getRow(4).height = 8

  ws.mergeCells('B1:F1')
  ws.getCell('B1').value = 'DANA USAHA HMTI'
  ws.getCell('B1').font = { bold: true, size: 18, color: { argb: UNGU } }
  ws.mergeCells('B2:F2')
  ws.getCell('B2').value = 'In4Days XI · Merchandise Pre-Order'
  ws.getCell('B2').font = { size: 10, color: { argb: 'FF64748B' } }
  ws.mergeCells('B3:F3')
  ws.getCell('B3').value = 'INVOICE PRE-ORDER'
  ws.getCell('B3').font = { bold: true, size: 11, color: { argb: 'FF0F172A' } }

  const dibayar = Number(po.sudah_dibayar ?? 0)
  const total = Number(po.total)
  const sisa = Math.max(0, total - dibayar)

  const meta: Array<[string, string, string, string]> = [
    ['Ditagihkan kepada', po.nama_pemesan, 'No. Invoice', po.no_po],
    ['Kategori', po.tipe_pemesan, 'Tanggal', waktu(po.created_at)],
    ['Kontak', po.kontak, 'Status', po.status === 'lunas' ? 'LUNAS' : po.status.replace(/_/g, ' ')],
    ['Pembayaran', `${po.pembayaran_metode || '-'} · ${po.pembayaran_tipe === 'nyicil' ? 'Nyicil' : 'Lunas'}`, 'Sisa Tagihan', `Rp ${sisa.toLocaleString('id-ID')}`],
  ]

  meta.forEach((row, index) => {
    const r = 5 + index
    ws.getRow(r).height = index === 0 ? 20 : 18
    ws.mergeCells(`A${r}:B${r}`)
    ws.mergeCells(`E${r}:F${r}`)
    ws.getCell(`A${r}`).value = row[0]
    ws.getCell(`A${r}`).font = { size: 9, color: { argb: 'FF64748B' } }
    ws.getCell(`C${r}`).value = row[1]
    ws.getCell(`C${r}`).font = { bold: true, size: 10, color: { argb: 'FF0F172A' } }
    ws.getCell(`D${r}`).value = row[2]
    ws.getCell(`D${r}`).font = { size: 9, color: { argb: 'FF64748B' } }
    ws.getCell(`E${r}`).value = row[3]
    ws.getCell(`E${r}`).font = { bold: true, size: 10, color: { argb: 'FF0F172A' } }
    ws.getCell(`E${r}`).alignment = { horizontal: 'right' }
  })

  const headerRow = 10
  const headers = ['No', 'Produk', 'Ukuran', 'Qty', 'Harga Satuan', 'Subtotal']
  headers.forEach((label, index) => {
    const cell = ws.getRow(headerRow).getCell(index + 1)
    cell.value = label
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: UNGU } }
    cell.alignment = { horizontal: index === 0 ? 'center' : index >= 3 ? 'right' : 'left', vertical: 'middle' }
    border(cell, UNGU)
  })
  ws.getRow(headerRow).height = 22

  items.forEach((item, index) => {
    const r = headerRow + 1 + index
    const values = [index + 1, item.nama, item.ukuran || '-', Number(item.qty), Number(item.harga_satuan), Number(item.subtotal)]
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

  const totalStart = headerRow + items.length + 1
  const totalRows: Array<[string, number, boolean]> = [
    ['Subtotal', items.reduce((sum, item) => sum + Number(item.subtotal), 0), false],
    ['Total Tagihan', total, true],
    ['Sudah Dibayar', dibayar, false],
    ['Sisa Tagihan', sisa, true],
  ]

  totalRows.forEach(([label, value, highlight], index) => {
    const r = totalStart + index
    ws.mergeCells(`A${r}:D${r}`)
    ws.mergeCells(`E${r}:F${r}`)
    const labelCell = ws.getCell(`A${r}`)
    labelCell.value = label
    labelCell.font = { bold: highlight, size: 10, color: { argb: highlight ? 'FF4C1D95' : 'FF475569' } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    if (highlight) labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: UNGU_MUDA } }

    const valueCell = ws.getCell(`E${r}`)
    valueCell.value = value
    valueCell.numFmt = '"Rp" #,##0'
    valueCell.font = { bold: highlight, size: index === 1 ? 12 : 10, color: { argb: highlight ? 'FF4C1D95' : 'FF0F172A' } }
    valueCell.alignment = { horizontal: 'right', vertical: 'middle' }
    if (highlight) valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: UNGU_MUDA } }
    ws.getRow(r).height = index === 1 ? 24 : 19
  })

  const noteRow = totalStart + totalRows.length + 1
  ws.mergeCells(`A${noteRow}:F${noteRow}`)
  ws.getCell(`A${noteRow}`).value =
    'Terima kasih telah melakukan pre-order merchandise Danus In4Days XI. Simpan invoice ini sebagai bukti pemesanan dan pengambilan.'
  ws.getCell(`A${noteRow}`).font = { italic: true, size: 9, color: { argb: 'FF94A3B8' } }
  ws.getCell(`A${noteRow}`).alignment = { wrapText: true, vertical: 'top' }
  ws.getRow(noteRow).height = 32

  ws.pageSetup.printArea = `A1:F${noteRow}`

  const buffer = await wb.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
