'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

type ConfirmOptions = {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false))

export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((input) => {
    setOptions(typeof input === 'string' ? { description: input } : input)
    setLeaving(false)
    setVisible(true)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  function close(result: boolean) {
    setLeaving(true)
    window.setTimeout(() => {
      setVisible(false)
      setLeaving(false)
      setOptions(null)
      resolver.current?.(result)
      resolver.current = null
    }, 160)
  }

  const danger = options?.danger ?? true

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {visible && options && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            onClick={() => close(false)}
            className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm ${leaving ? 'animate-overlay-out' : 'animate-overlay-in'}`}
          />
          <div
            role="alertdialog"
            aria-modal="true"
            className={`relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-2xl ${leaving ? 'animate-dialog-out' : 'animate-dialog-in'}`}
          >
            <button
              onClick={() => close(false)}
              aria-label="Tutup"
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
            <div className={`mb-4 grid h-12 w-12 place-items-center rounded-2xl ${danger ? 'bg-red-50 text-red-600' : 'bg-primary-50 text-primary-600'}`}>
              <AlertTriangle className="h-6 w-6 animate-pulse" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{options.title ?? 'Konfirmasi'}</h2>
            {options.description && <p className="mt-1 text-sm leading-relaxed text-slate-500">{options.description}</p>}
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => close(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                {options.cancelText ?? 'Batal'}
              </button>
              <button
                onClick={() => close(true)}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'}`}
              >
                {options.confirmText ?? 'Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
