type Field = { id: string; value: string }

function parsePayload(payload: string): Field[] {
  const clean = payload.replace(/\s+/g, '')
  const fields: Field[] = []
  let i = 0
  while (i + 4 <= clean.length) {
    const id = clean.slice(i, i + 2)
    const len = Number(clean.slice(i + 2, i + 4))
    if (!Number.isInteger(len) || len < 0 || i + 4 + len > clean.length) break
    fields.push({ id, value: clean.slice(i + 4, i + 4 + len) })
    i += 4 + len
  }
  return fields
}

export function crc16(input: string): string {
  let crc = 0xffff
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function buatQrisTanpaNominal(payload: string): string {
  const clean = payload.replace(/\s+/g, '')
  if (!clean) return clean

  const fields = parsePayload(clean)
  if (fields.length === 0) return clean

  const map = new Map<string, string>()
  for (const field of fields) {
    if (field.id !== '63') map.set(field.id, field.value)
  }
  map.set('01', '11')
  map.delete('54')
  map.delete('55')

  const body = [...map.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, value]) => `${id}${String(value.length).padStart(2, '0')}${value}`)
    .join('')

  const base = `${body}6304`
  return `${base}${crc16(base)}`
}

export function buatQrisDinamis(payload: string, nominal: number): string {
  const clean = payload.replace(/\s+/g, '')
  if (!clean || !Number.isFinite(nominal) || nominal <= 0) return clean

  const fields = parsePayload(clean)
  if (fields.length === 0) return clean

  const map = new Map<string, string>()
  for (const field of fields) {
    if (field.id !== '63') map.set(field.id, field.value)
  }
  map.set('01', '12')
  map.set('54', String(Math.round(nominal)))
  map.delete('55')

  const body = [...map.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, value]) => `${id}${String(value.length).padStart(2, '0')}${value}`)
    .join('')

  const base = `${body}6304`
  return `${base}${crc16(base)}`
}
