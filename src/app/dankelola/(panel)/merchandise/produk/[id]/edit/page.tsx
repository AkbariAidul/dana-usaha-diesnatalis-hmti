'use client'

import { useParams } from 'next/navigation'
import ProdukForm from '../../form'

export default function ProdukEditPage() {
  const { id } = useParams<{ id: string }>()
  return <ProdukForm id={id} />
}
