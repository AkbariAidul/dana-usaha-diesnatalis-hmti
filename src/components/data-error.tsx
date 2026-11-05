'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import animationData from '@/assets/lottie/no-internet.json'

const Lottie = dynamic(() => import('lottie-react').then((mod) => mod.Lottie), { ssr: false })

type Props = {
  title?: string
  onRetry?: () => void
}

export function DataError({ title = 'Gagal memuat data', onRetry }: Props) {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return (
    <div role="alert" className="flex w-full max-w-xs flex-col items-center text-center sm:max-w-sm">
      <Lottie src={animationData} loop autoplay className="-mb-2 h-20 w-20 sm:h-28 sm:w-28" />
      <h2 className="mt-1 text-sm font-semibold text-slate-900 sm:text-base">
        {online ? title : 'Tidak ada koneksi internet'}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
        {online
          ? 'Server belum bisa dihubungi. Periksa koneksi lalu coba lagi.'
          : 'Perangkatmu sedang offline. Sambungkan ke jaringan internet, lalu coba lagi.'}
      </p>
      <button
        onClick={onRetry ?? (() => window.location.reload())}
        className="mt-3 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-medium text-white sm:mt-4 sm:px-4 sm:py-2 sm:text-sm"
      >
        Coba Lagi
      </button>
    </div>
  )
}
