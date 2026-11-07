import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type Visit = {
  path: string
  visitor_id: string | null
  ip_address: string | null
  user_agent: string | null
  location: string | null
  created_at: string
}

const STORAGE_LIMIT_BYTES = Number(process.env.SUPABASE_STORAGE_LIMIT_BYTES) || 1024 ** 3

const DATE_KEY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

function dateKey(value: string | number | Date) {
  return DATE_KEY.format(new Date(value))
}

function lastDays(count: number) {
  const days: string[] = []
  const now = Date.now()
  for (let i = count - 1; i >= 0; i--) days.push(dateKey(now - i * 86_400_000))
  return days
}

async function tableCount(table: string) {
  const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
  return error ? null : count ?? 0
}

async function bucketUsage(bucket: string, prefix = '', depth = 0): Promise<{ size: number; files: number }> {
  if (depth > 8) return { size: 0, files: 0 }
  let size = 0
  let files = 0
  let offset = 0
  const limit = 1000

  while (true) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    })
    if (error) throw error

    for (const item of data ?? []) {
      if (!item.id) {
        const child = prefix ? `${prefix}/${item.name}` : item.name
        const nested = await bucketUsage(bucket, child, depth + 1)
        size += nested.size
        files += nested.files
      } else {
        size += Number(item.metadata?.size ?? 0)
        files += 1
      }
    }

    if ((data ?? []).length < limit) break
    offset += limit
  }

  return { size, files }
}

async function storageUsage() {
  try {
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets()
    if (error) throw error
    const rows = await Promise.all(
      (buckets ?? []).map(async (bucket) => {
        try {
          const usage = await bucketUsage(bucket.name)
          return { name: bucket.name, ...usage }
        } catch (error) {
          return { name: bucket.name, size: 0, files: 0, error: String(error) }
        }
      }),
    )
    const total = rows.reduce((sum, row) => sum + row.size, 0)
    return {
      total,
      files: rows.reduce((sum, row) => sum + row.files, 0),
      limit: STORAGE_LIMIT_BYTES,
      remaining: Math.max(0, STORAGE_LIMIT_BYTES - total),
      percent: Math.min(100, (total / STORAGE_LIMIT_BYTES) * 100),
      buckets: rows,
    }
  } catch (error) {
    return {
      total: 0,
      files: 0,
      limit: STORAGE_LIMIT_BYTES,
      remaining: STORAGE_LIMIT_BYTES,
      percent: 0,
      buckets: [],
      error: String(error),
    }
  }
}

type VercelDeployment = {
  uid?: string
  id?: string
  name?: string
  url?: string
  state?: string
  target?: string | null
  created?: number
  createdAt?: number
  buildingAt?: number
  readyAt?: number
  ready?: number
  readySubstate?: string
  source?: string
  alias?: string[]
  regions?: string[]
  inspectorUrl?: string
  creator?: { username?: string; email?: string }
  meta?: Record<string, string>
}

type VercelProject = {
  id?: string
  name?: string
  framework?: string | null
  createdAt?: number
  nodeVersion?: string
  rootDirectory?: string | null
  buildCommand?: string | null
  devCommand?: string | null
  installCommand?: string | null
  outputDirectory?: string | null
}

type VercelDeploymentsResponse = { deployments?: VercelDeployment[] }

async function vercelJson<T>(path: string, token: string, params: URLSearchParams): Promise<T | null> {
  try {
    const res = await fetch(`https://api.vercel.com${path}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return await res.json() as T
  } catch {
    return null
  }
}

function iso(value?: number) {
  return value ? new Date(value).toISOString() : null
}

function vercelCommit(meta: Record<string, string> | undefined) {
  if (!meta) return null
  const provider =
    meta.githubCommitRef !== undefined ? 'GitHub'
    : meta.gitlabCommitRef !== undefined ? 'GitLab'
    : meta.bitbucketCommitRef !== undefined ? 'Bitbucket'
    : null
  const prefix =
    provider === 'GitHub' ? 'github'
    : provider === 'GitLab' ? 'gitlab'
    : provider === 'Bitbucket' ? 'bitbucket'
    : null
  if (!provider || !prefix) return null
  return {
    provider,
    branch: meta[`${prefix}CommitRef`] ?? null,
    sha: meta[`${prefix}CommitSha`] ?? null,
    message: meta[`${prefix}CommitMessage`] ?? null,
    author: meta[`${prefix}CommitAuthorName`] ?? null,
    authorLogin: meta[`${prefix}CommitAuthorLogin`] ?? null,
    repo: meta[`${prefix}CommitRepo`] ?? null,
    org: meta[`${prefix}CommitOrg`] ?? null,
  }
}

function mapDeployment(deployment: VercelDeployment | null, detail: VercelDeployment | null) {
  if (!deployment && !detail) return null
  const merged = { ...deployment, ...detail }
  const created = merged.created ?? merged.createdAt
  const readyAt = merged.readyAt ?? (merged.ready && merged.ready > 1 ? merged.ready : null)
  const commit = vercelCommit(merged.meta)
  return {
    id: merged.uid ?? merged.id ?? null,
    name: merged.name ?? null,
    state: merged.state ?? (merged.ready ? 'READY' : 'BUILDING'),
    target: merged.target ?? null,
    url: merged.url ? `https://${merged.url}` : null,
    inspectorUrl: merged.inspectorUrl ?? null,
    createdAt: iso(created),
    buildingAt: iso(merged.buildingAt),
    readyAt: iso(readyAt ?? undefined),
    durationSeconds: created && readyAt ? Math.max(0, Math.round((readyAt - created) / 1000)) : null,
    readySubstate: merged.readySubstate ?? null,
    source: merged.source ?? null,
    aliases: merged.alias ?? [],
    regions: merged.regions ?? [],
    creator: merged.creator ?? null,
    commit,
    meta: merged.meta ?? null,
  }
}

async function vercelStatus() {
  const token = process.env.VERCEL_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  const teamId = process.env.VERCEL_TEAM_ID
  const dashboardUrl = 'https://vercel.com/dashboard'
  const usageUrl = 'https://vercel.com/dashboard/usage'

  if (!token || !projectId) {
    return { configured: false, dashboardUrl, usageUrl, project: null, latest: null, recent: [] }
  }

  try {
    const params = new URLSearchParams({ projectId, limit: '5' })
    if (teamId) params.set('teamId', teamId)
    const data = await vercelJson<VercelDeploymentsResponse>('/v6/deployments', token, params)
    if (!data) throw new Error('Vercel API tidak bisa diakses')
    const deployments = data.deployments ?? []
    const deployment = deployments[0]

    const projectParams = new URLSearchParams()
    if (teamId) projectParams.set('teamId', teamId)
    const detailParams = new URLSearchParams()
    if (teamId) detailParams.set('teamId', teamId)

    const [detail, project] = await Promise.all([
      deployment?.uid
        ? vercelJson<VercelDeployment>(`/v13/deployments/${deployment.uid}`, token, detailParams)
        : Promise.resolve(null),
      vercelJson<VercelProject>(`/v9/projects/${projectId}`, token, projectParams),
    ])

    return {
      configured: true,
      dashboardUrl,
      usageUrl,
      project: project
        ? {
            id: project.id ?? null,
            name: project.name ?? null,
            framework: project.framework ?? null,
            createdAt: iso(project.createdAt),
            nodeVersion: project.nodeVersion ?? null,
            rootDirectory: project.rootDirectory ?? null,
            buildCommand: project.buildCommand ?? null,
            devCommand: project.devCommand ?? null,
            installCommand: project.installCommand ?? null,
            outputDirectory: project.outputDirectory ?? null,
          }
        : null,
      latest: mapDeployment(deployment ?? null, detail),
      recent: deployments.slice(1).map((item) => mapDeployment(item, null)),
    }
  } catch (error) {
    return { configured: true, dashboardUrl, usageUrl, project: null, latest: null, recent: [], error: String(error) }
  }
}

export async function GET() {
  const [storage, vercel, counts] = await Promise.all([
    storageUsage(),
    vercelStatus(),
    Promise.all(
      ['tenants', 'pendaftaran_tenant_pub', 'pembayaran', 'merchandise', 'merch_po', 'kasir_transaksi', 'pesanan_tiket', 'audit_log', 'public_visitor']
        .map(async (table) => [table, await tableCount(table)] as const),
    ),
  ])

  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('public_visitor')
    .select('path,visitor_id,ip_address,user_agent,location,created_at')
    .gte('created_at', monthAgo)
    .order('created_at', { ascending: false })
    .limit(10_000)

  const visits = (data ?? []) as Visit[]
  const today = dateKey(Date.now())
  const days7 = new Set(lastDays(7))
  const days14 = lastDays(14)
  const pages = new Map<string, number>()
  const daily = new Map(days14.map((day) => [day, 0]))
  const unique = new Set<string>()

  for (const visit of visits) {
    const key = dateKey(visit.created_at)
    if (daily.has(key)) daily.set(key, (daily.get(key) ?? 0) + 1)
    pages.set(visit.path, (pages.get(visit.path) ?? 0) + 1)
    unique.add(visit.visitor_id || `${visit.ip_address ?? '-'}|${visit.user_agent ?? '-'}`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const projectRef =
    process.env.SUPABASE_PROJECT_REF ||
    /https:\/\/([^.]+)\.supabase\.co/.exec(supabaseUrl)?.[1] ||
    null

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    visitors: {
      ready: !error,
      today: visits.filter((visit) => dateKey(visit.created_at) === today).length,
      last7: visits.filter((visit) => days7.has(dateKey(visit.created_at))).length,
      last30: visits.length,
      unique30: unique.size,
      daily: days14.map((day) => ({ date: day, total: daily.get(day) ?? 0 })),
      topPages: Array.from(pages.entries())
        .map(([path, total]) => ({ path, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
      recent: visits.slice(0, 20),
      error: error ? String(error) : null,
    },
    storage,
    database: {
      counts: Object.fromEntries(counts),
      total: counts.reduce((sum, [, count]) => sum + (count ?? 0), 0),
    },
    vercel,
    supabase: {
      projectRef,
      dashboardUrl: projectRef ? `https://supabase.com/dashboard/project/${projectRef}/usage` : 'https://supabase.com/dashboard',
    },
  })
}
