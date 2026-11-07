'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsViewer } from '@/lib/dashboard-user'
import { PageSkeleton } from '../../../ui'
import ProdukForm from '../form'

export default function ProdukCreatePage() {
  const isViewer = useIsViewer()
  const router = useRouter()

  useEffect(() => {
    if (isViewer) router.replace('/dankelola/merchandise/produk')
  }, [isViewer, router])

  if (isViewer) return <PageSkeleton />
  return <ProdukForm />
}
