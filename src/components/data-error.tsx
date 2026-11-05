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
    <div role="alert" className="flex w-full max-w-sm flex-col items-center text-center">
      <Lottie src={animationData} loop autoplay className="-mb-2 h-28 w-28" />
      <h2 className="mt-1 text-base font-semibold text-slate-900">
        {online ? title : 'Tidak ada koneksi internet'}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        {online
          ? 'Server belum bisa dihubungi. Periksa koneksi lalu coba lagi.'
          : 'Perangkatmu sedang offline. Sambungkan ke jaringan internet, lalu coba lagi.'}
      </p>
      <button
        onClick={onRetry ?? (() => window.location.reload())}
        className="mt-4 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white"
      >
        Coba Lagi
      </button>
    </div>
  )
}
