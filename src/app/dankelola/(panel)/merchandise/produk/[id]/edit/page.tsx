'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useIsViewer } from '@/lib/dashboard-user'
import { PageSkeleton } from '../../../../ui'
import ProdukForm from '../../form'

export default function ProdukEditPage() {
  const { id } = useParams<{ id: string }>()
  const isViewer = useIsViewer()
  const router = useRouter()

  useEffect(() => {
    if (isViewer) router.replace(`/dankelola/merchandise/produk/${id}`)
  }, [id, isViewer, router])

  if (isViewer) return <PageSkeleton />
  return <ProdukForm id={id} />
}
