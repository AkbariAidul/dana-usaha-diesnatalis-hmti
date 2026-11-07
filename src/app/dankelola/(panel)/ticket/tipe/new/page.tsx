'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsViewer } from '@/lib/dashboard-user'
import { PageSkeleton } from '../../../ui'
import TipeDetail from '../[id]/tipe-detail'

export default function TipeCreatePage() {
  const isViewer = useIsViewer()
  const router = useRouter()

  useEffect(() => {
    if (isViewer) router.replace('/dankelola/ticket/tahap')
  }, [isViewer, router])

  if (isViewer) return <PageSkeleton />
  return <TipeDetail create />
}
