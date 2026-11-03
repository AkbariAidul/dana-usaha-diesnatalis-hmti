'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function Modal({
  open,
  onClose,
  children,
  panelClassName = 'w-full max-w-md rounded-2xl bg-white p-5 shadow-xl',
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  panelClassName?: string
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={panelClassName}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
