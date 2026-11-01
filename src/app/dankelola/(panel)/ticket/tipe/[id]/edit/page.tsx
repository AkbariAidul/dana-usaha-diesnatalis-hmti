'use client'

import TipeDetail from '../tipe-detail'

export default function TipeEditPage({ params }: { params: Promise<{ id: string }> }) {
  return <TipeDetail params={params} />
}
