'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useIsViewer } from '@/lib/dashboard-user'
import { PageSkeleton } from '../../ui'
import PaketForm from '../form'

export default function PaketCreatePage() {
  const isViewer = useIsViewer()
  const router = useRouter()

  useEffect(() => {
    if (isViewer) router.replace('/dankelola/paket')
  }, [isViewer, router])

  if (isViewer) return <PageSkeleton />
  return <PaketForm />
}
