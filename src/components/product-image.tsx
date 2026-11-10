'use client'

import Image, { type ImageProps } from 'next/image'
import { useState, type ReactNode } from 'react'

export function ProductImage({
  src,
  fallback,
  alt,
  ...props
}: Omit<ImageProps, 'src'> & { src: string | null; fallback: ReactNode }) {
  const [error, setError] = useState(false)
  if (!src || error) return <>{fallback}</>
  return <Image src={src} alt={alt} onError={() => setError(true)} {...props} />
}
