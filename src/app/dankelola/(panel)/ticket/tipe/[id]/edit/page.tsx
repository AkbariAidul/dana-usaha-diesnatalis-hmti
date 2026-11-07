'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useIsViewer } from '@/lib/dashboard-user'
import { PageSkeleton } from '../../../../ui'
import TipeDetail from '../tipe-detail'

export default function TipeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = useParams<{ id: string }>()
  const isViewer = useIsViewer()
  const router = useRouter()

  useEffect(() => {
    if (isViewer) router.replace(`/dankelola/ticket/tipe/${id}`)
  }, [id, isViewer, router])

  if (isViewer) return <PageSkeleton />
  return <TipeDetail params={params} />
}
