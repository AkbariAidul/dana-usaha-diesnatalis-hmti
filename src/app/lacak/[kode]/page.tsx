import { LacakDetail } from './detail'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ kode: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { kode } = await params
  const { t } = await searchParams
  return <LacakDetail kode={kode} token={t ?? ''} />
}
