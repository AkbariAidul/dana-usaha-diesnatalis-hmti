import { formatRupiah } from '@/lib/utils'

export type ReportSummary = { label: string; value: string }

export type ReportSheet = {
  name: string
  headers: string[]
  rows: Array<Array<string | number>>
  widths?: number[]
  currencyCols?: number[]
}

export type ReportPayload = {
  title: string
  filename: string
  summary: ReportSummary[]
  sheets: ReportSheet[]
}

function fileDate() {
  return new Date().toISOString().slice(0, 10)
}

function safeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Data'
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportReportXlsx(report: ReportPayload) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const summaryRows: Array<Array<string | number>> = [
    [report.title],
    ['Dibuat', new Date().toLocaleString('id-ID')],
    [],
    ['Ringkasan', 'Nilai'],
    ...report.summary.map((item) => [item.label, item.value]),
  ]
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows)
  summarySheet['!cols'] = [{ wch: 30 }, { wch: 28 }]
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Ringkasan')

  for (const sheet of report.sheets) {
    const aoa: Array<Array<string | number>> = [sheet.headers, ...sheet.rows]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = sheet.headers.map((header, col) => {
      const longest = Math.max(
        header.length,
        ...sheet.rows.map((row) => String(row[col] ?? '').length),
      )
      return { wch: Math.min(38, Math.max(10, longest + 2)) }
    })
    if (sheet.rows.length > 0) {
      ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { r: 0, c: 0 },
          e: { r: aoa.length - 1, c: sheet.headers.length - 1 },
        }),
      }
    }
    for (const col of sheet.currencyCols ?? []) {
      for (let row = 1; row < aoa.length; row += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col })
        const cell = ws[address]
        if (cell && typeof cell.v === 'number') cell.z = '"Rp"#,##0'
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheet.name))
  }

  XLSX.writeFile(wb, `${report.filename}-${fileDate()}.xlsx`)
}

const PAGE_W = 841.89
const PAGE_H = 595.28
const MARGIN = 30
const CONTENT_W = PAGE_W - MARGIN * 2

function safePdfText(value: string | number) {
  return String(value)
    .replace(/[—–]/g, '-')
    .replace(/·/g, '-')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, '?')
}

function wrapText(text: string, font: import('pdf-lib').PDFFont, size: number, maxWidth: number) {
  const lines: string[] = []
  for (const paragraph of safePdfText(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word
        continue
      }
      let part = ''
      for (const char of word) {
        if (font.widthOfTextAtSize(part + char, size) <= maxWidth) {
          part += char
        } else {
          if (part) lines.push(part)
          part = char
        }
      }
      line = part
    }
    lines.push(line)
  }
  return lines.length > 0 ? lines : ['']
}

export async function exportReportPdf(report: ReportPayload) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const pages: import('pdf-lib').PDFPage[] = []

  const slate900 = rgb(0.07, 0.09, 0.15)
  const slate500 = rgb(0.39, 0.45, 0.55)
  const slate200 = rgb(0.89, 0.91, 0.94)
  const slate100 = rgb(0.95, 0.96, 0.98)
  const primary = rgb(0.29, 0.13, 0.52)

  function newPage() {
    const page = doc.addPage([PAGE_W, PAGE_H])
    pages.push(page)
    return page
  }

  let page = newPage()
  let y = PAGE_H - MARGIN

  page.drawText(safePdfText(report.title), { x: MARGIN, y: y - 18, size: 18, font: bold, color: slate900 })
  y -= 26
  page.drawText(`Dibuat: ${new Date().toLocaleString('id-ID')}`, { x: MARGIN, y, size: 8, font, color: slate500 })
  y -= 16

  if (report.summary.length > 0) {
    const gap = 8
    const cardW = (CONTENT_W - gap * (report.summary.length - 1)) / report.summary.length
    const cardH = 42
    report.summary.forEach((item, index) => {
      const x = MARGIN + index * (cardW + gap)
      page.drawRectangle({ x, y: y - cardH, width: cardW, height: cardH, color: slate100 })
      page.drawText(safePdfText(item.label), { x: x + 8, y: y - 14, size: 7.5, font, color: slate500 })
      page.drawText(safePdfText(item.value), { x: x + 8, y: y - 32, size: 11, font: bold, color: primary })
    })
    y -= cardH + 16
  }

  for (const sheet of report.sheets) {
    if (y < MARGIN + 80) {
      page = newPage()
      y = PAGE_H - MARGIN
    }
    page.drawText(safePdfText(sheet.name), { x: MARGIN, y: y - 12, size: 11, font: bold, color: primary })
    y -= 22

    const colCount = sheet.headers.length
    const weights = sheet.widths?.length === colCount
      ? sheet.widths
      : sheet.headers.map(() => 1)
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    const colWidths = weights.map((w) => (CONTENT_W * w) / totalWeight)
    const colX = colWidths.reduce<number[]>((acc, width, index) => {
      acc.push(index === 0 ? MARGIN : acc[index - 1] + colWidths[index - 1])
      return acc
    }, [])

    function drawHeader() {
      const headerLines = sheet.headers.map((header, index) =>
        wrapText(header, bold, 7.5, colWidths[index] - 8),
      )
      const headerH = Math.max(18, Math.max(...headerLines.map((lines) => lines.length)) * 9 + 8)
      page.drawRectangle({ x: MARGIN, y: y - headerH, width: CONTENT_W, height: headerH, color: primary })
      sheet.headers.forEach((_, index) => {
        headerLines[index].forEach((line, lineIndex) => {
          page.drawText(line, {
            x: colX[index] + 4,
            y: y - 11 - lineIndex * 9,
            size: 7.5,
            font: bold,
            color: rgb(1, 1, 1),
          })
        })
      })
      y -= headerH
    }

    function drawRow(row: Array<string | number>, rowIndex: number) {
      const values = row.map((value, index) => {
        const isCurrency = sheet.currencyCols?.includes(index)
        return typeof value === 'number' && isCurrency ? formatRupiah(value) : String(value ?? '')
      })
      const cellLines = values.map((value, index) =>
        wrapText(value, font, 7.5, colWidths[index] - 8),
      )
      const rowH = Math.max(16, Math.max(...cellLines.map((lines) => lines.length)) * 9 + 7)
      if (y - rowH < MARGIN + 18) {
        page = newPage()
        y = PAGE_H - MARGIN
        page.drawText(safePdfText(`${sheet.name} (lanjutan)`), { x: MARGIN, y: y - 12, size: 9, font: bold, color: primary })
        y -= 20
        drawHeader()
      }
      if (rowIndex % 2 === 1) {
        page.drawRectangle({ x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH, color: slate100 })
      }
      page.drawLine({ start: { x: MARGIN, y: y - rowH }, end: { x: MARGIN + CONTENT_W, y: y - rowH }, thickness: 0.5, color: slate200 })
      cellLines.forEach((lines, index) => {
        lines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x: colX[index] + 4,
            y: y - 10 - lineIndex * 9,
            size: 7.5,
            font,
            color: slate900,
          })
        })
      })
      y -= rowH
    }

    drawHeader()
    if (sheet.rows.length === 0) {
      page.drawText('Belum ada data.', { x: MARGIN + 4, y: y - 12, size: 8, font, color: slate500 })
      y -= 20
    } else {
      sheet.rows.forEach((row, index) => drawRow(row, index))
    }
    y -= 16
  }

  pages.forEach((item, index) => {
    const footer = `Halaman ${index + 1} dari ${pages.length}`
    const width = font.widthOfTextAtSize(footer, 7.5)
    item.drawText(footer, {
      x: PAGE_W - MARGIN - width,
      y: 14,
      size: 7.5,
      font,
      color: slate500,
    })
    item.drawText('Dana Usaha HMTI', { x: MARGIN, y: 14, size: 7.5, font, color: slate500 })
  })

  doc.setTitle(report.title)
  doc.setAuthor('Dana Usaha HMTI')
  const bytes = await doc.save()
  download(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${report.filename}-${fileDate()}.pdf`)
}
