import { promises as fs } from 'fs'
import path from 'path'
import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib'

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

const PAGE_W = 595.28
const PAGE_H = 841.89
const MARGIN = 36
const CONTENT_W = PAGE_W - MARGIN * 2
const QR_SIZE = 64
const COL_X = [MARGIN, 56, 186, 330, 366, 440, PAGE_W - MARGIN] as const
const COL_W = COL_X.slice(1).map((x, i) => x - COL_X[i])

const UNGU = rgb(124 / 255, 58 / 255, 237 / 255)
const UNGU_TUA = rgb(76 / 255, 29 / 255, 149 / 255)
const UNGU_MUDA = rgb(245 / 255, 243 / 255, 255 / 255)
const ABU = rgb(248 / 255, 250 / 255, 252 / 255)
const GARIS = rgb(226 / 255, 232 / 255, 240 / 255)
const DARK = rgb(15 / 255, 23 / 255, 42 / 255)
const GRAY = rgb(100 / 255, 116 / 255, 139 / 255)
const WHITE = rgb(1, 1, 1)

function aman(value: string) {
  return String(value)
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u00b7\u2022]/g, '-')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
}

function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  })
    .format(Number(value) || 0)
    .replace(/\u00a0/g, ' ')
}

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

function potong(value: string, font: PDFFont, size: number, maxWidth: number) {
  const text = aman(value)
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let low = 0
  let high = text.length
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if (font.widthOfTextAtSize(`${text.slice(0, mid)}...`, size) <= maxWidth) low = mid
    else high = mid - 1
  }
  return `${text.slice(0, low).trimEnd()}...`
}

export function namaFileStruk(noInvoice: string) {
  return `invoice-${noInvoice}.pdf`
}

async function buatInvoicePdf({
  jenis,
  noInvoice,
  meta,
  detailHeader,
  lines,
  totals,
  note,
  qrUrl,
}: {
  jenis: string
  noInvoice: string
  meta: InvoiceMeta[]
  detailHeader: string
  lines: InvoiceLine[]
  totals: InvoiceTotal[]
  note: string
  qrUrl?: string | null
}): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Invoice ${noInvoice}`)
  doc.setAuthor('Dana Usaha HMTI')
  doc.setCreator('Dana Usaha HMTI')

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique)

  let logo: PDFImage | null = null
  try {
    const bytes = await fs.readFile(path.join(process.cwd(), 'public', 'logo-dies-struk.png'))
    logo = await doc.embedPng(bytes)
  } catch {
    logo = null
  }

  let qr: PDFImage | null = null
  if (qrUrl) {
    try {
      const bytes = await QRCode.toBuffer(qrUrl, {
        type: 'png',
        width: 256,
        margin: 1,
        errorCorrectionLevel: 'M',
      })
      qr = await doc.embedPng(bytes)
    } catch {
      qr = null
    }
  }

  const noteLines: string[] = []
  let noteLine = ''
  for (const word of aman(note).split(/\s+/)) {
    const next = noteLine ? `${noteLine} ${word}` : word
    if (italic.widthOfTextAtSize(next, 8.5) > CONTENT_W) {
      if (noteLine) noteLines.push(noteLine)
      noteLine = word
    } else {
      noteLine = next
    }
  }
  if (noteLine) noteLines.push(noteLine)

  const tinggiTotal = totals.reduce((sum, total) => sum + (total.big ? 24 : 19), 0)
  const tinggiIsi =
    88 +
    meta.length * 18 +
    12 +
    20 +
    lines.length * 18 +
    10 +
    tinggiTotal +
    14 +
    Math.min(noteLines.length, 4) * 11
  const satuHalaman = tinggiIsi + 74 <= PAGE_H
  const tinggiHalaman = satuHalaman ? tinggiIsi + 74 : PAGE_H

  let page: PDFPage = doc.addPage([PAGE_W, tinggiHalaman])
  let y = 0

  const t = (value: string, x: number, baseline: number, f: PDFFont, size: number, color: RGB) => {
    page.drawText(aman(value), { x, y: baseline, size, font: f, color })
  }
  const tRight = (value: string, x: number, baseline: number, f: PDFFont, size: number, color: RGB) => {
    const text = aman(value)
    t(text, x - f.widthOfTextAtSize(text, size), baseline, f, size, color)
  }
  const tCenter = (value: string, x: number, baseline: number, f: PDFFont, size: number, color: RGB) => {
    const text = aman(value)
    t(text, x - f.widthOfTextAtSize(text, size) / 2, baseline, f, size, color)
  }

  const gambarHeader = (pertama: boolean) => {
    const top = page.getSize().height - MARGIN
    if (pertama) {
      if (logo) {
        const size = 64
        const scale = size / Math.max(logo.width, logo.height)
        page.drawImage(logo, {
          x: MARGIN,
          y: top - size,
          width: logo.width * scale,
          height: logo.height * scale,
        })
      }
      if (qr) {
        const qx = PAGE_W - MARGIN - QR_SIZE
        page.drawImage(qr, { x: qx, y: top - QR_SIZE, width: QR_SIZE, height: QR_SIZE })
        tCenter('Scan riwayat', qx + QR_SIZE / 2, top - QR_SIZE - 8, font, 7, GRAY)
      }
      tCenter('DANA USAHA HMTI', PAGE_W / 2, top - 20, bold, 18, UNGU)
      tCenter('In4Days XI - Tenant, Merchandise & Ticket', PAGE_W / 2, top - 38, font, 9, GRAY)
      tCenter(jenis, PAGE_W / 2, top - 56, bold, 10, DARK)
      y = top - 88
    } else {
      t('DANA USAHA HMTI', MARGIN, top - 12, bold, 12, UNGU)
      tRight(noInvoice, PAGE_W - MARGIN, top - 12, bold, 9, GRAY)
      page.drawLine({
        start: { x: MARGIN, y: top - 22 },
        end: { x: PAGE_W - MARGIN, y: top - 22 },
        thickness: 0.5,
        color: GARIS,
      })
      y = top - 40
    }
  }

  const gambarHeaderTabel = () => {
    const height = 20
    page.drawRectangle({ x: MARGIN, y: y - height, width: CONTENT_W, height, color: UNGU })
    const labels = ['No', 'Item', detailHeader, 'Qty', 'Harga Satuan', 'Subtotal']
    labels.forEach((label, index) => {
      const baseline = y - height + 7
      if (index === 0) {
        tCenter(label, COL_X[0] + COL_W[0] / 2, baseline, bold, 8, WHITE)
      } else if (index >= 3) {
        tRight(label, COL_X[index] + COL_W[index] - 3, baseline, bold, 8, WHITE)
      } else {
        t(label, COL_X[index] + 3, baseline, bold, 8, WHITE)
      }
    })
    y -= height
  }

  const halamanBaru = () => {
    page = doc.addPage([PAGE_W, PAGE_H])
    gambarHeader(false)
    gambarHeaderTabel()
  }

  gambarHeader(true)

  meta.forEach((row, index) => {
    const rowTop = y - index * 18
    const baseline = rowTop - 12
    t(row[0], MARGIN, baseline, font, 8, GRAY)
    t(potong(row[1], bold, 9, 210), 104, baseline, bold, 9, DARK)
    tRight(row[2], 330, baseline, font, 8, GRAY)
    tRight(potong(row[3], bold, 9, 160), PAGE_W - MARGIN, baseline, bold, 9, DARK)
    page.drawLine({
      start: { x: MARGIN, y: rowTop - 16 },
      end: { x: PAGE_W - MARGIN, y: rowTop - 16 },
      thickness: 0.5,
      color: GARIS,
    })
  })

  y -= meta.length * 18 + 12
  gambarHeaderTabel()

  const rowHeight = 18
  lines.forEach((line, index) => {
    if (!satuHalaman && y - rowHeight < MARGIN + 120) halamanBaru()
    const values = [
      String(index + 1),
      line.nama,
      line.detail || '-',
      String(line.qty),
      rupiah(line.harga_satuan),
      rupiah(line.subtotal),
    ]
    const top = y
    if (index % 2 === 1) {
      page.drawRectangle({ x: MARGIN, y: top - rowHeight, width: CONTENT_W, height: rowHeight, color: ABU })
    }
    COL_W.forEach((width, col) => {
      page.drawRectangle({
        x: COL_X[col],
        y: top - rowHeight,
        width,
        height: rowHeight,
        borderColor: GARIS,
        borderWidth: 0.5,
      })
      const text = potong(values[col], font, 8.5, width - 6)
      if (col === 0) {
        tCenter(text, COL_X[col] + width / 2, top - 12, font, 8.5, DARK)
      } else if (col >= 3) {
        tRight(text, COL_X[col] + width - 3, top - 12, font, 8.5, DARK)
      } else {
        t(text, COL_X[col] + 3, top - 12, font, 8.5, DARK)
      }
    })
    y -= rowHeight
  })

  if (!satuHalaman && y - tinggiTotal - 70 < MARGIN) {
    page = doc.addPage([PAGE_W, PAGE_H])
    gambarHeader(false)
  }

  y -= 10
  totals.forEach((total) => {
    const height = total.big ? 24 : 19
    if (total.highlight) {
      page.drawRectangle({ x: MARGIN, y: y - height, width: CONTENT_W, height, color: UNGU_MUDA })
    }
    const f = total.highlight ? bold : font
    const color = total.highlight ? UNGU_TUA : DARK
    tRight(total.label, 430, y - height + 7, f, 9, total.highlight ? UNGU_TUA : GRAY)
    tRight(rupiah(total.value), PAGE_W - MARGIN - 4, y - height + 6, f, total.big ? 12 : 9, color)
    y -= height
  })

  y -= 14
  const noteCount = Math.min(noteLines.length, 4)
  noteLines.slice(0, noteCount).forEach((text, index) => {
    t(text, MARGIN, y - index * 11, italic, 8.5, GRAY)
  })

  if (!satuHalaman) {
    const noteBottom = noteCount > 0 ? y - (noteCount - 1) * 11 - 2 : y
    const delta = noteBottom - 44
    if (delta > 0) {
      page.translateContent(0, -delta)
      const { width, height } = page.getSize()
      page.setSize(width, height - delta)
      y -= delta
    }
  }

  const pages = doc.getPages()
  pages.forEach((current, index) => {
    const label = `Halaman ${index + 1} dari ${pages.length}`
    current.drawLine({
      start: { x: MARGIN, y: 30 },
      end: { x: PAGE_W - MARGIN, y: 30 },
      thickness: 0.5,
      color: GARIS,
    })
    current.drawText(aman(noInvoice), { x: MARGIN, y: 18, size: 8, font, color: GRAY })
    current.drawText(aman(label), {
      x: PAGE_W - MARGIN - font.widthOfTextAtSize(aman(label), 8),
      y: 18,
      size: 8,
      font,
      color: GRAY,
    })
  })

  return Buffer.from(await doc.save())
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

const STATUS_PO: Record<string, string> = {
  menunggu_verifikasi: 'Menunggu Verifikasi',
  dp_diterima: 'DP Diterima',
  lunas: 'LUNAS',
  ditolak: 'Ditolak',
  batal: 'Dibatalkan',
}

export async function buatStrukPoPdf(po: StrukPo, items: StrukItem[], qrUrl?: string): Promise<Buffer> {
  const dibayar = Number(po.sudah_dibayar ?? 0)
  const total = Number(po.total)
  const sisa = Math.max(0, total - dibayar)

  return buatInvoicePdf({
    jenis: 'INVOICE PRE-ORDER',
    noInvoice: po.no_po,
    detailHeader: 'Ukuran',
    meta: [
      ['Nama', po.nama_pemesan, 'No. Invoice', po.no_po],
      ['Kontak', po.kontak, 'Tanggal', waktu(po.created_at)],
      ['Kategori', po.tipe_pemesan, 'Status', STATUS_PO[po.status] ?? po.status.replace(/_/g, ' ')],
      ['Bayar', `${po.pembayaran_metode || '-'} - ${po.pembayaran_tipe === 'nyicil' ? 'Nyicil' : 'Lunas'}`, 'Sisa Tagihan', rupiah(sisa)],
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
    qrUrl,
  })
}

type StrukTenant = {
  kode_stand: string
  nama_usaha: string
  kontak: string
  harga_akhir: number
  base_harga: number
  sudah_dibayar: number | null
  status: string
  tgl_daftar: string
  kategori: string
  jumlah_tenant: number
  jenis_usaha_qty?: { fnb?: number; nonFnb?: number } | null
}

const STATUS_TENANT: Record<string, string> = {
  daftar: 'Terdaftar',
  dp: 'DP Diterima',
  dp_diterima: 'DP Diterima',
  cicil: 'Dicicil',
  lunas: 'LUNAS',
  ditolak: 'Ditolak',
  batal: 'Dibatalkan',
  menunggak: 'Menunggak',
}

export async function buatStrukTenantPdf(
  tenant: StrukTenant,
  addon: Array<{ nama: string; qty: number; harga_satuan: number; subtotal: number }>,
  qrUrl?: string
): Promise<Buffer> {
  const total = Number(tenant.harga_akhir)
  // Base harga sewa tempat per-jumlah-tenant; fallback ke harga_akhir jika belum ada (tenant lama sebelum migrasi 033)
  const baseHarga = Number(tenant.base_harga || Math.max(0, total - addon.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)))
  const dibayar = Number(tenant.sudah_dibayar ?? 0)
  const sisa = Math.max(0, total - dibayar)
  const jumlahTenant = Math.max(1, Number(tenant.jumlah_tenant || 1))
  const qtyJenis = tenant.jenis_usaha_qty
  const fnb = Math.max(0, Number(qtyJenis?.fnb ?? 0))
  const nonFnb = Math.max(0, Number(qtyJenis?.nonFnb ?? 0))
  const rincianJenis =
    fnb > 0 && nonFnb > 0
      ? `F&B ${fnb} + Non-F&B ${nonFnb}`
      : nonFnb > 0
        ? `Non-F&B ${nonFnb}`
        : fnb > 0
          ? `F&B ${fnb}`
          : `${jumlahTenant} tenant`

  return buatInvoicePdf({
    jenis: 'INVOICE TENANT',
    noInvoice: tenant.kode_stand,
    detailHeader: 'Keterangan',
    meta: [
      ['Nama', tenant.nama_usaha, 'No. Invoice', tenant.kode_stand],
      ['Kontak', tenant.kontak, 'Tanggal', waktu(tenant.tgl_daftar)],
      ['Kategori', tenant.kategori, 'Status', STATUS_TENANT[tenant.status] ?? tenant.status.replace(/_/g, ' ')],
      ['Jumlah Tenant', `${jumlahTenant} (${rincianJenis})`, 'Sisa Tagihan', rupiah(sisa)],
    ],
    lines: [
      {
        nama: `${tenant.kategori} (Tempat)`,
        detail: `Sewa tempat - ${rincianJenis}`,
        qty: jumlahTenant,
        harga_satuan: Math.round(baseHarga / jumlahTenant),
        subtotal: baseHarga,
      },
      ...addon.map((item) => ({
        nama: item.nama,
        detail: 'Add-on',
        qty: Number(item.qty),
        harga_satuan: Number(item.harga_satuan),
        subtotal: Number(item.subtotal),
      })),
    ],
    totals: [
      { label: 'Subtotal', value: total },
      { label: 'Total Tagihan', value: total, highlight: true, big: true },
      { label: 'Sudah Dibayar', value: dibayar },
      { label: 'Sisa Tagihan', value: sisa, highlight: true },
    ],
    note: 'Terima kasih telah mendaftar sebagai tenant Danus In4Days XI. Simpan invoice ini sebagai bukti pembayaran dan check-in venue.',
    qrUrl,
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

type StrukBundle = {
  no_pesanan: string
  nama_pembeli: string
  kontak: string
  email: string | null
  total: number
  status: string
  created_at: string
  bundle_nama: string | null
}

export async function buatStrukBundlePdf(
  order: StrukBundle,
  items: Array<{ nama: string; detail: string | null; qty: number; harga_satuan: number; subtotal: number }>,
  qrUrl?: string
): Promise<Buffer> {
  const total = Number(order.total)
  const dibayar = order.status === 'lunas' ? total : 0

  return buatInvoicePdf({
    jenis: 'INVOICE PAKET COMBO',
    noInvoice: order.no_pesanan,
    detailHeader: 'Varian',
    meta: [
      ['Nama', order.nama_pembeli, 'No. Invoice', order.no_pesanan],
      ['Kontak', order.email ? `${order.kontak} - ${order.email}` : order.kontak, 'Tanggal', waktu(order.created_at)],
      ['Paket', order.bundle_nama || 'Paket Combo', 'Status', STATUS_TIKET[order.status] ?? order.status.replace(/_/g, ' ')],
      ['Total Paket', rupiah(total), 'Dibayar', rupiah(dibayar)],
    ],
    lines: items.map((item) => ({
      nama: item.nama,
      detail: item.detail,
      qty: Number(item.qty),
      harga_satuan: Number(item.harga_satuan),
      subtotal: Number(item.subtotal),
    })),
    totals: [
      { label: 'Total Paket', value: total, highlight: true, big: true },
      { label: 'Sudah Dibayar', value: dibayar },
    ],
    note: 'Terima kasih telah membeli paket combo Danus In4Days XI. Simpan invoice ini sebagai bukti pembelian. QR tiket & pengambilan merchandise dapat dilihat pada halaman riwayat.',
    qrUrl,
  })
}

export async function buatStrukTiketPdf(pesanan: StrukTiket, qrUrl?: string): Promise<Buffer> {
  const jumlah = Number(pesanan.jumlah)
  const hargaSatuan = Number(pesanan.harga_satuan)
  const subtotal = jumlah * hargaSatuan
  const total = Number(pesanan.total)
  const diskon = Math.max(0, subtotal - total)
  const dibayar = pesanan.status === 'lunas' ? total : 0
  const sisa = Math.max(0, total - dibayar)

  return buatInvoicePdf({
    jenis: 'INVOICE TIKET',
    noInvoice: pesanan.no_pesanan,
    detailHeader: 'Periode',
    meta: [
      ['Nama', pesanan.nama_pembeli, 'No. Invoice', pesanan.no_pesanan],
      ['Kontak', pesanan.email ? `${pesanan.kontak} - ${pesanan.email}` : pesanan.kontak, 'Tanggal', waktu(pesanan.created_at)],
      ['Tipe Tiket', pesanan.tiket_nama || 'Tiket', 'Status', STATUS_TIKET[pesanan.status] ?? pesanan.status.replace(/_/g, ' ')],
      ['Periode', pesanan.periode_nama || 'Harga dasar', 'Total Tagihan', rupiah(total)],
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
    qrUrl,
  })
}
