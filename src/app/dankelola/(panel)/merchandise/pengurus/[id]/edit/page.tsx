'use client'

import { useParams } from 'next/navigation'
import PengurusForm from '../../form'

export default function PengurusEditPage() {
  const { id } = useParams<{ id: string }>()
  return <PengurusForm id={id} />
}
