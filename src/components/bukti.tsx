'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Modal } from './modal'

export function BuktiThumb({
  url,
  label,
  onPreview,
}: {
  url: string
  label: string
  onPreview: () => void
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary-600 hover:underline">
        Lihat
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={onPreview}
      className="group relative block h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:ring-2 hover:ring-primary-200"
      title="Lihat bukti pembayaran"
    >
      <img
        src={url}
        alt={label}
        decoding="async"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-900/0 text-[10px] font-semibold text-white opacity-0 transition group-hover:bg-slate-900/50 group-hover:opacity-100">
        Lihat
      </span>
    </button>
  )
}

export function BuktiPreviewModal({
  url,
  onClose,
  title = 'Bukti Pembayaran',
}: {
  url: string | null
  onClose: () => void
  title?: string
}) {
  return (
    <Modal
      open={!!url}
      onClose={onClose}
      panelClassName="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="bg-slate-50 p-3">
        <div className="mx-auto aspect-[4/5] w-full overflow-hidden rounded-lg bg-slate-100">
          {url && <img src={url} alt={title} className="h-full w-full object-contain" />}
        </div>
      </div>
    </Modal>
  )
}
