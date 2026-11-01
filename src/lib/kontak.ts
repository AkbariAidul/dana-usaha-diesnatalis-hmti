export function normalisasiKontak(value: string | null | undefined) {
  const raw = (value ?? '').trim().toLowerCase()
  if (!raw) return ''
  if (raw.includes('@')) return raw
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('62')) return `0${digits.slice(2)}`
  if (digits.startsWith('8')) return `0${digits}`
  return digits
}

export function kontakCocok(input: string, kontak: string | null | undefined, email?: string | null) {
  const a = normalisasiKontak(input)
  if (!a) return false
  return a === normalisasiKontak(kontak) || (!!email && a === normalisasiKontak(email))
}
