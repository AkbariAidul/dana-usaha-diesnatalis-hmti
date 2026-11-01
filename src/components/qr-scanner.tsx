'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, CameraOff } from 'lucide-react'

export function QrScanner({ onScan }: { onScan: (value: string) => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const lastRef = useRef({ value: '', at: 0 })
  const [aktif, setAktif] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    return () => {
      const scanner = scannerRef.current
      scannerRef.current = null
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => {})
      }
    }
  }, [])

  async function mulai() {
    setError('')
    try {
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (value) => {
          const now = Date.now()
          if (value === lastRef.current.value && now - lastRef.current.at < 2500) return
          lastRef.current = { value, at: now }
          onScan(value)
        },
        () => {},
      )
      setAktif(true)
    } catch (err) {
      setError((err as Error).message || 'Kamera tidak bisa dibuka')
      scannerRef.current = null
    }
  }

  async function berhenti() {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      await scanner.stop()
      scanner.clear()
    } catch {
      // ignore
    }
    setAktif(false)
  }

  return (
    <div className="space-y-3">
      <div id="qr-reader" className="overflow-hidden rounded-xl bg-slate-900 [&_video]:w-full" />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={aktif ? berhenti : mulai}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        {aktif ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
        {aktif ? 'Matikan Kamera' : 'Aktifkan Kamera'}
      </button>
      <p className="text-xs text-slate-500">Kamera butuh HTTPS atau localhost. Bisa juga ketik kode manual di bawah.</p>
    </div>
  )
}
