'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Globe, LogOut, Menu, PartyPopper, X } from 'lucide-react'
import { getJSON, prefetch } from '../api'
import { menuConfig } from '@/lib/menu'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { useConfirm } from '@/components/confirm-dialog'
import type { DashboardRole, DashboardUser } from '@/lib/auth'

const MENU_HREFS = menuConfig.flatMap((group) =>
  group.children ? group.children.map((child) => child.href) : group.href ? [group.href] : []
)

const MENU_ALIASES: Record<string, string[]> = {
  '/dankelola/ticket/tahap': ['/dankelola/ticket/tipe', '/dankelola/ticket/periode', '/dankelola/ticket/modal'],
}

function matchesPath(pathname: string, href: string, prefix: string) {
  if (href === '/dankelola') return pathname === '/dankelola'
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function bestActiveHref(pathname: string) {
  let best: string | null = null
  let bestLength = -1
  for (const href of MENU_HREFS) {
    for (const prefix of [href, ...(MENU_ALIASES[href] ?? [])]) {
      if (matchesPath(pathname, href, prefix) && prefix.length > bestLength) {
        best = href
        bestLength = prefix.length
      }
    }
  }
  return best
}

function isPathActive(pathname: string, href: string) {
  return bestActiveHref(pathname) === href
}

function parseDashboardUser(raw: string): DashboardUser | null {
  try {
    return JSON.parse(decodeURIComponent(raw))
  } catch {
    try {
      return JSON.parse(decodeURIComponent(decodeURIComponent(raw)))
    } catch {
      return null
    }
  }
}

function findActiveGroup(pathname: string) {
  for (const group of menuConfig) {
    if (group.href && isPathActive(pathname, group.href)) return group.key
    if (group.children) {
      for (const child of group.children) {
        if (isPathActive(pathname, child.href)) return group.key
      }
    }
  }
  return null
}

function getBreadcrumbs(pathname: string) {
  const items = menuConfig.flatMap((group) =>
    group.children ?? (group.href ? [{ label: group.label, href: group.href }] : [])
  )
  let active: { label: string; href: string } | undefined
  // Exact match or direct child (skip root, it prefixes every path)
  for (const item of items) {
    if (item.href === '/dankelola') continue
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!active || item.href.length > active.href.length) active = item
    }
  }
  // Fallback: deepest common prefix when sub-page shares parent path
  if (!active) {
    let bestMatch = 0
    for (const item of items) {
      const segs = item.href.split('/').filter(Boolean)
      const parts = pathname.split('/').filter(Boolean)
      let match = 0
      for (let i = 0; i < Math.min(segs.length, parts.length); i++) {
        if (segs[i] !== parts[i]) break
        match++
      }
      if (match >= 2 && match > bestMatch) {
        bestMatch = match
        active = item
      }
    }
  }
  const breadcrumbs: { label: string; href: string }[] = [{ label: 'Dashboard', href: '/dankelola' }]

  // Active child / page
  if (active && active.href !== '/dankelola') {
    breadcrumbs.push({ label: active.label, href: active.href })
  }

  // Sub-pages that extend the active page
  if (pathname.startsWith('/dankelola/ticket/tipe/')) {
    const action = pathname === '/dankelola/ticket/tipe/new' ? 'Tambah Tipe' : 'Edit Tipe'
    breadcrumbs.push({ label: action, href: pathname })
  } else if (pathname.startsWith('/dankelola/ticket/periode/')) {
    const action = pathname === '/dankelola/ticket/periode/new' ? 'Tambah Periode' : 'Edit Periode'
    breadcrumbs.push({ label: action, href: pathname })
  } else if (pathname === '/dankelola/ticket/modal') {
    breadcrumbs.push({ label: 'Kelola Modal', href: pathname })
  } else if (pathname.startsWith('/dankelola/merchandise/pengurus/')) {
    const action = pathname === '/dankelola/merchandise/pengurus/new' ? 'Tambah Pengurus' : 'Edit Pengurus'
    breadcrumbs.push({ label: action, href: pathname })
  } else if (pathname.startsWith('/dankelola/merchandise/produk/')) {
    const action = pathname === '/dankelola/merchandise/produk/new' ? 'Tambah Produk' : 'Edit Produk'
    breadcrumbs.push({ label: action, href: pathname })
  }

  return breadcrumbs
}

const ROLE_LABEL: Record<DashboardRole, string> = {
  tenant: 'tenant',
  merchandise: 'merchandise',
  ticket: 'tiket',
}

const WELCOME_COPY: Record<DashboardRole, (name: string) => { title: string; body: string }> = {
  tenant: (name) => ({
    title: `Yo, ${name}!`,
    body: 'Tenant hari ini udah nungguin nih. Yuk gas kelola biar makin rapi dan cuan.',
  }),
  merchandise: (name) => ({
    title: `Halo, ${name}!`,
    body: 'Merchandise udah siap diurus. Gas kelola dengan baik biar makin laris.',
  }),
  ticket: (name) => ({
    title: `Halo, ${name}!`,
    body: 'Tiket-tiketnya udah nungguin. Yuk kelola dengan baik biar makin aman.',
  }),
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [currentUser, setCurrentUser] = useState<DashboardUser | null>(null)
  const [welcome, setWelcome] = useState<DashboardUser | null>(null)
  const [tiketTerjual, setTiketTerjual] = useState<number | null>(null)
  const [produkCount, setProdukCount] = useState<number | null>(null)
  const [checkinStats, setCheckinStats] = useState<{ terpakai: number; total: number } | null>(null)
  const breadcrumbs = getBreadcrumbs(pathname)

  const loadBadges = useCallback(async () => {
    const [tipe, checkin, merchandise] = await Promise.all([
      getJSON<{ terjual: number | null }[]>('/api/ticket'),
      getJSON<{ status: string }[]>('/api/ticket/checkin'),
      getJSON<unknown[]>('/api/merchandise'),
    ])
    setTiketTerjual(tipe.reduce((sum, t) => sum + Number(t.terjual ?? 0), 0))
    setProdukCount(merchandise.length)
    setCheckinStats({
      terpakai: checkin.filter((t) => t.status === 'terpakai').length,
      total: checkin.length,
    })
  }, [])
  const welcomeCopy = welcome ? WELCOME_COPY[welcome.role](welcome.name) : null

  useEffect(() => {
    const activeKey = findActiveGroup(pathname)
    setOpenGroups((prev) => {
      const next = { ...prev }
      if (activeKey) next[activeKey] = true
      return next
    })
  }, [pathname])

  useEffect(() => {
    const t = setTimeout(() => {
      prefetch([
        '/api/tenants', '/api/pembayaran', '/api/master', '/api/acara',
        '/api/merchandise', '/api/ticket', '/api/audit',
      ])
    }, 600)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    loadBadges().catch(() => {})
  }, [loadBadges])
  useLiveRefresh(loadBadges, 15000)

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )dashboard_user=([^;]+)/)
    if (match) {
      setCurrentUser(parseDashboardUser(match[1]))
    }
    const pending = sessionStorage.getItem('dashboard_welcome')
    if (pending) {
      sessionStorage.removeItem('dashboard_welcome')
      try {
        setWelcome(JSON.parse(pending))
      } catch {
        setWelcome(null)
      }
    }
  }, [])

  async function logout() {
    const done = await confirm({
      title: 'Cek dulu, ya!',
      description: currentUser
        ? `${currentUser.name} udah selesai kelola ${ROLE_LABEL[currentUser.role]} hari ini?`
        : 'Udah selesai kerja hari ini?',
      confirmText: 'Udah, cabut!',
      cancelText: 'Belum nih',
      danger: false,
    })
    if (!done) return
    await fetch('/api/auth/logout', { method: 'POST' } as RequestInit)
    router.push('/')
    router.refresh()
  }

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const nav = (
    <nav className="flex flex-col gap-0.5 px-1.5" aria-label="Navigasi dashboard">
      {menuConfig.map((group) => {
        const Icon = group.icon
        if (group.href && !group.children) {
          const active = isPathActive(pathname, group.href)
          return (
            <Link
              key={group.key}
              href={group.href}
              onClick={() => setOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                active
                  ? 'bg-white/18 text-white font-medium'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 transition-colors ${
                active ? 'text-white' : 'text-[#E9D5FF]'
              }`} />
              <span className="flex-1">{group.label}</span>
            </Link>
          )
        }

        const isOpen = openGroups[group.key] ?? false
        const hasActiveChild = group.children?.some((child) => isPathActive(pathname, child.href)) ?? false
        const groupActive = hasActiveChild

        return (
          <div key={group.key} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              aria-expanded={isOpen}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all duration-150 ${
                groupActive
                  ? 'text-white bg-white/10'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 transition-colors ${
                groupActive ? 'text-white' : 'text-[#E9D5FF]'
              }`} />
              <span className="flex-1 text-xs font-semibold uppercase tracking-wider">
                {group.label}
              </span>
              <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${
                isOpen ? 'rotate-90' : ''
              } ${groupActive ? 'text-white' : 'text-white/60'}`} />
            </button>
            {isOpen && group.children && (
              <div className="ml-6 mt-0.5 pb-1 sidebar-tree">
                {group.children.map((child) => {
                  const childActive = isPathActive(pathname, child.href)
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setOpen(false)}
                      aria-current={childActive ? 'page' : undefined}
                      className={`sidebar-tree-item flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm transition-all duration-150 ${
                        childActive
                          ? 'bg-white/20 text-white font-medium'
                          : 'text-white hover:bg-white/10'
                      }`}
                    >
                      <span>{child.label}</span>
                      {child.href === '/dankelola/merchandise/produk' && produkCount !== null && (
                        <span className="ml-auto min-w-[1.5rem] shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white">
                          {produkCount}
                        </span>
                      )}
                      {child.href === '/dankelola/ticket/penjualan' && tiketTerjual !== null && (
                        <span className="ml-auto min-w-[1.5rem] shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white">
                          {tiketTerjual}
                        </span>
                      )}
                      {child.href === '/dankelola/ticket/checkin' && checkinStats && (
                        <span
                          title={`${checkinStats.terpakai} sudah check-in dari ${checkinStats.total} tiket`}
                          className="ml-auto min-w-[1.5rem] shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white"
                        >
                          {checkinStats.terpakai}/{checkinStats.total}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <header className="shrink-0 border-b border-slate-200 bg-white z-30">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          <div className="-ml-4 flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              aria-label="Buka menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden mr-1"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Image src="/logo-dies.png" alt="Logo HIMA TI" width={120} height={40} className="h-auto w-24 sm:w-[120px] rounded-lg shrink-0" />
            <div className="leading-tight">
              <p className="text-sm font-bold text-slate-900">Dana Usaha HMTI</p>
              <p className="text-[10px] text-slate-500">Sistem Pengelolaan Dana Usaha</p>
            </div>
            <nav className="ml-2 hidden md:flex items-center gap-2 border-l border-slate-200 pl-4 text-sm" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.href} className="flex items-center gap-2">
                  {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                  {idx === breadcrumbs.length - 1 ? (
                    <span className="text-slate-700 font-medium">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="text-slate-500 hover:text-slate-700 transition-colors">
                      {crumb.label}
                    </Link>
                  )}
                </div>
              ))}
            </nav>
          </div>
          {currentUser && (
            <div className="hidden items-center gap-3 md:flex">
              <div className="text-right leading-tight">
                <p className="text-sm font-medium text-slate-900">{currentUser.name}</p>
                <p className="text-[11px] text-slate-500">
                  Kelola <span className="capitalize">{ROLE_LABEL[currentUser.role]}</span>
                </p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-600 text-sm font-semibold text-white">
                {currentUser.name.trim().charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-[#6D28D9] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
              <div className="flex items-center gap-2">
                <Image src="/logo-dies.png" alt="Logo" width={100} height={33} className="h-auto w-24 rounded-lg bg-white p-1" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-white">Dana Usaha</p>
                  <p className="text-[10px] text-white/60">Dies Natalis</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">{nav}</div>
            <div className="border-t border-white/15 px-3 py-3 space-y-1">
              <Link href="/" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white">
                <Globe className="h-4 w-4 shrink-0" />
                <span>Halaman Publik</span>
              </Link>
                <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-300 transition-all hover:bg-red-500/20 hover:text-red-200">
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Keluar</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Layout */}
      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-white/15 bg-[#6D28D9]">
          <div className="flex-1 overflow-y-auto py-2">{nav}</div>
          <div className="shrink-0 border-t border-white/15 px-3 py-3 space-y-1">
            <Link href="/" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white">
              <Globe className="h-4 w-4 shrink-0" />
              <span>Halaman Publik</span>
            </Link>
            <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-300 transition-all hover:bg-red-500/20 hover:text-red-200">
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Keluar</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div
            key={pathname}
            className={`px-4 py-6 md:px-8 md:py-8 animate-fade-in ${
              pathname.startsWith('/dankelola/ticket/tipe') ||
              pathname.startsWith('/dankelola/ticket/periode') ||
              pathname.startsWith('/dankelola/ticket/tahap') ||
              pathname.startsWith('/dankelola/ticket/modal') ||
              pathname.startsWith('/dankelola/ticket/penjualan') ||
              pathname.startsWith('/dankelola/ticket/checkin') ||
              pathname.startsWith('/dankelola/merchandise')
                ? 'w-full'
                : 'mx-auto max-w-6xl'
            }`}
          >
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-500 md:hidden">
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.href} className="flex items-center gap-2">
                  {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-400" />}
                  {idx === breadcrumbs.length - 1 ? (
                    <span className="text-slate-900 font-medium">{crumb.label}</span>
                  ) : (
                    <Link href={crumb.href} className="hover:text-slate-700">
                      {crumb.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
            {children}
          </div>
        </main>
      </div>

      {welcome && welcomeCopy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setWelcome(null)} />
          <div
            role="alertdialog"
            aria-modal="true"
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-2xl animate-dialog-in"
          >
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary-50 text-primary-600">
              <PartyPopper className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{welcomeCopy.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{welcomeCopy.body}</p>
            <button
              onClick={() => setWelcome(null)}
              className="mt-6 w-full rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              Gas, mulai!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
