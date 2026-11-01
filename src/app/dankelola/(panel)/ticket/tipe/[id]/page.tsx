'use client'

import TipeDetail from './tipe-detail'

export default function TipeViewPage({ params }: { params: Promise<{ id: string }> }) {
  return <TipeDetail params={params} readOnly />
}
