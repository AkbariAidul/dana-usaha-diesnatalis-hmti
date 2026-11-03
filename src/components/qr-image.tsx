'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function QrImage({
  value,
  size = 240,
  className = '',
}: {
  value: string
  size?: number
  className?: string
}) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let active = true
    QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: 'H' })
      .then((url) => { if (active) setSrc(url) })
      .catch(() => { if (active) setSrc('') })
    return () => { active = false }
  }, [value, size])

  if (!src) {
    return <div className={`animate-pulse rounded-xl bg-slate-100 ${className}`} style={{ width: size, height: size }} />
  }
  return <img src={src} alt="QR Code" className={`rounded-xl ${className}`} style={{ width: size, height: size }} />
}
