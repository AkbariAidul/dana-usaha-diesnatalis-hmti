'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronRight, Eye, Globe, LogOut, Menu, PartyPopper, X } from 'lucide-react'
import { getJSON, prefetch } from '../api'
import { menuConfig, getMenuForRole } from '@/lib/menu'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { useConfirm } from '@/components/confirm-dialog'
import { OWNER_NAME, type DashboardRole, type DashboardUser } from '@/lib/auth'
import { useDashboardUser } from '@/lib/dashboard-user'
import type { Tenant } from '@/lib/types'

const MENU_HREFS = menuConfig.flatMap((group) =>
  group.children ? group.children.map((child) => child.href) : group.href ? [group.href] : []
)

const MENU_ALIASES: Record<string, string[]> = {
  '/dankelola/ticket/tahap': ['/dankelola/ticket/tipe', '/dankelola/ticket/periode', '/dankelola/ticket/modal'],
  '/dankelola/merchandise/produk': ['/dankelola/merchandise/modal'],
  '/dankelola/merchandise/stok': ['/dankelola/merchandise/pengambilan'],
  '/dankelola/tenants/harga': ['/dankelola/tenants/pembayaran'],
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
  if (pathname === '/dankelola/tenants/pembayaran') {
    breadcrumbs.length = 1
    breadcrumbs.push({ label: 'Paket & Harga', href: '/dankelola/tenants/harga' })
    breadcrumbs.push({ label: 'Batas Pembayaran', href: pathname })
  } else if (pathname.startsWith('/dankelola/ticket/tipe/')) {
    const action = pathname === '/dankelola/ticket/tipe/new'
      ? 'Tambah Tipe'
      : pathname.endsWith('/edit') ? 'Edit Tipe' : 'Detail Tipe'
    breadcrumbs.push({ label: action, href: pathname })
  } else if (pathname.startsWith('/dankelola/ticket/periode/')) {
    const action = pathname === '/dankelola/ticket/periode/new' ? 'Tambah Periode' : 'Edit Periode'
    breadcrumbs.push({ label: action, href: pathname })
  } else if (pathname.startsWith('/dankelola/tenants/harga/')) {
    const action = pathname.endsWith('/new') ? 'Tambah Paket' : pathname.endsWith('/edit') ? 'Edit Paket' : 'Detail Paket'
    breadcrumbs.push({ label: action, href: pathname })
  } else if (
    pathname.startsWith('/dankelola/tenants/') &&
    !['/dankelola/tenants/harga', '/dankelola/tenants/pembayaran', '/dankelola/tenants/peralatan', '/dankelola/tenants/kuota']
      .some((base) => pathname === base || pathname.startsWith(`${base}/`))
  ) {
    breadcrumbs.push({ label: 'Detail Tenant', href: pathname })
  } else if (pathname === '/dankelola/ticket/modal') {
    breadcrumbs.push({ label: 'Kelola Modal', href: pathname })
  } else if (pathname === '/dankelola/merchandise/pengambilan') {
    breadcrumbs.length = 1
    breadcrumbs.push({ label: 'Produksi & Stok', href: '/dankelola/merchandise/stok' })
    breadcrumbs.push({ label: 'Pengaturan Pengambilan', href: pathname })
  } else if (pathname.startsWith('/dankelola/merchandise/pengurus/')) {
    const action = pathname === '/dankelola/merchandise/pengurus/new' ? 'Tambah Pengurus' : 'Edit Pengurus'
    breadcrumbs.push({ label: action, href: pathname })
  } else if (pathname.startsWith('/dankelola/merchandise/produk/')) {
    const action = pathname === '/dankelola/merchandise/produk/new'
      ? 'Tambah Produk'
      : pathname.endsWith('/edit') ? 'Edit Produk' : 'Detail Produk'
    breadcrumbs.push({ label: action, href: pathname })
  } else if (pathname === '/dankelola/merchandise/kasir/new') {
    breadcrumbs.push({ label: 'Transaksi Baru', href: pathname })
  } else if (pathname === '/dankelola/merchandise/modal') {
    breadcrumbs.push({ label: 'Kelola Modal', href: pathname })
  }

  return breadcrumbs
}

const ROLE_LABEL: Record<DashboardRole, string> = {
  tenant: 'tenant',
  merchandise: 'merchandise',
  ticket: 'tiket',
  viewer: 'lihat saja',
  pengelola: 'pengelola',
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
  viewer: (name) => ({
    title: `Halo, ${name}!`,
    body: 'Kamu masuk dalam mode lihat saja. Semua data bisa dipantau tanpa bisa diubah.',
  }),
  pengelola: (name) => ({
    title: `Halo, ${name}!`,
    body: 'Semua data udah siap dipantau. Yuk kelola dengan rapi biar makin cuan.',
  }),
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const confirm = useConfirm()
  const [open, setOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const currentUser = useDashboardUser()
  // Viewer hanya lihat Ringkasan, Scan, dan Laporan
  const menuGroups = getMenuForRole(currentUser?.role ?? 'pengelola')
  const lastAuditPath = useRef<string | null>(null)
  const [welcome, setWelcome] = useState<DashboardUser | null>(null)
  const [tiketTerjual, setTiketTerjual] = useState<number | null>(null)
  const [tenantCount, setTenantCount] = useState<number | null>(null)
  const [vendorItemCount, setVendorItemCount] = useState<number | null>(null)
  const [tipeCount, setTipeCount] = useState<number | null>(null)
  const [produkCount, setProdukCount] = useState<number | null>(null)
  const [paketCount, setPaketCount] = useState<number | null>(null)
  const [pengurusCount, setPengurusCount] = useState<number | null>(null)
  const [preorderCount, setPreorderCount] = useState<number | null>(null)
  const [preorderLunasCount, setPreorderLunasCount] = useState<number | null>(null)
  const [kasirStats, setKasirStats] = useState<{ terjual: number; total: number } | null>(null)
  const [checkinStats, setCheckinStats] = useState<{ terpakai: number; total: number } | null>(null)
  const breadcrumbs = getBreadcrumbs(pathname)

  // ponytail: load each badge independently — one failing API must not poison every other badge.
  const loadBadges = useCallback(async () => {
    async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
      try { return await fn() } catch { return fallback }
    }
    const [tipe, checkin, merchandise, pengurus, preorder, kasir, master, tenants] = await Promise.all([
      safe(() => getJSON<{ terjual: number | null }[]>('/api/ticket'), []),
      safe(() => getJSON<{ status: string }[]>('/api/ticket/checkin'), []),
      safe(() => getJSON<unknown[]>('/api/merchandise'), []),
      safe(() => getJSON<unknown[]>('/api/pengurus'), []),
      safe(() => getJSON<{ status: string }[]>('/api/merchandise/preorder'), []),
      safe(() => getJSON<{ terjual: number; total: number }>('/api/merchandise/kasir?ringkasan=1'), { terjual: 0, total: 0 }),
      safe(() => getJSON<{ kategori: { kode: string }[] }>('/api/master'), { kategori: [] }),
      safe(() => getJSON<Tenant[]>('/api/tenants'), []),
    ])
    const tenantAktif = (tenants ?? []).filter((t) => t.status !== 'batal')
    setTiketTerjual(((tipe ?? []) as Array<{ terjual?: number | null }>).reduce((sum, t) => sum + Number(t.terjual ?? 0), 0))
    setTenantCount(tenantAktif.length)
    setVendorItemCount(new Set(tenantAktif.flatMap((t) => ((t.addon ?? []) as Array<{ nama?: string }>).map((a) => (a.nama ?? '').trim().toLowerCase())).filter(Boolean)).size)
    setTipeCount((tipe ?? []).length)
    setProdukCount((merchandise ?? []).length)
    setPaketCount(((master?.kategori ?? []) as Array<{ kode?: string }>).filter((k) => k.kode && /^KT-\d+$/.test(k.kode) && k.kode !== 'KT-03').length)
    setPengurusCount((pengurus ?? []).length)
    setPreorderCount((preorder ?? []).length)
    setPreorderLunasCount(((preorder ?? []) as Array<{ status?: string }>).filter((po) => po.status === 'lunas').length)
    setKasirStats(kasir ?? { terjual: 0, total: 0 })
    setCheckinStats({
      terpakai: (((checkin ?? []) as Array<{ status?: string }>)).filter((t) => t.status === 'terpakai').length,
      total: (checkin ?? []).length,
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

  useEffect(() => {
    if (!currentUser) return
    const timer = setTimeout(() => {
      if (lastAuditPath.current === pathname) return
      lastAuditPath.current = pathname
      fetch('/api/audit/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => {})
    }, 500)
    return () => clearTimeout(timer)
  }, [currentUser, pathname])

  async function logout() {
    const done = await confirm({
      title: 'Cek dulu, ya!',
      description: currentUser
        ? currentUser.role === 'viewer'
          ? `${currentUser.name} udah selesai lihat-lihat hari ini?`
          : `${currentUser.name} udah selesai kelola ${ROLE_LABEL[currentUser.role]} hari ini?`
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

  async function logoutAllDevices() {
    const done = await confirm({
      title: 'Logout semua perangkat?',
      description: 'Semua sesi login Anda di device lain akan dicabut. Session di device ini juga akan habis.',
      confirmText: 'Cabut Semua',
      cancelText: 'Batal',
      danger: true,
    })
    if (!done) return
    try {
      await fetch('/api/auth/logout-all', { method: 'POST' })
      await fetch('/api/auth/logout', { method: 'POST' } as RequestInit)
      router.push('/')
      router.refresh()
    } catch {
      // Fallback: just regular logout
      await fetch('/api/auth/logout', { method: 'POST' } as RequestInit)
      router.push('/')
      router.refresh()
    }
  }

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const nav = (
    <nav className="flex flex-col gap-0.5 px-1.5" aria-label="Navigasi dashboard">
      {menuGroups.map((group) => {
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
        const children = group.children?.filter(
          (child) => child.href !== '/dankelola/pengaturan/users' || currentUser?.name === OWNER_NAME,
        )
        const hasActiveChild = children?.some((child) => isPathActive(pathname, child.href)) ?? false
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
            {isOpen && children && (
              <div className="ml-6 mt-0.5 pb-1 sidebar-tree">
                {children.map((child) => {
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
                      {child.href === '/dankelola/tenants' && tenantCount !== null && (
                        <span
                          title={`${tenantCount} tenant aktif`}
                          className="ml-auto min-w-[1.5rem] shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white"
                        >
                          {tenantCount}
                        </span>
                      )}
                      {child.href === '/dankelola/tenants/peralatan' && vendorItemCount !== null && (
                        <span
                          title={`${vendorItemCount} jenis item perlu disewa`}
                          className="ml-auto min-w-[1.5rem] shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white"
                        >
                          {vendorItemCount}
                        </span>
                      )}
                      {child.href === '/dankelola/tenants/harga' && paketCount !== null && (
                        <span
                          title={`${paketCount} paket tenant`}
                          className="ml-auto min-w-[1.5rem] shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white"
                        >
                          {paketCount}
                        </span>
                      )}
                      {child.href === '/dankelola/merchandise/produk' && produkCount !== null && (
                        <span className="ml-auto min-w-[1.5rem] shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white">
                          {produkCount}
                        </span>
                      )}
                      {child.href === '/dankelola/merchandise/pengurus' && pengurusCount !== null && (
                        <span className="ml-auto min-w-[1.5rem] shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white">
                          {pengurusCount}
                        </span>
                      )}
                      {child.href === '/dankelola/merchandise/preorder' && preorderCount !== null && (
                        <span className="ml-auto min-w-[1.5rem] shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white">
                          {preorderCount}
                        </span>
                      )}
                      {child.href === '/dankelola/merchandise/stok' && preorderLunasCount !== null && (
                        <span
                          title={`${preorderLunasCount} preorder lunas siap diproduksi`}
                          className="ml-auto min-w-[1.5rem] shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white"
                        >
                          {preorderLunasCount}
                        </span>
                      )}
                      {child.href === '/dankelola/merchandise/kasir' && kasirStats && (
                        <span
                          title={`${kasirStats.terjual} produk terjual dari total ${kasirStats.total} stok`}
                          className="ml-auto min-w-[1.5rem] shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white"
                        >
                          {kasirStats.terjual}/{kasirStats.total}
                        </span>
                      )}
                      {child.href === '/dankelola/ticket/tahap' && tipeCount !== null && (
                        <span className="ml-auto min-w-[1.5rem] shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white">
                          {tipeCount}
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
              {currentUser.role === 'viewer' && (
                <div className="hidden items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 lg:flex">
                  <Eye className="h-3.5 w-3.5 shrink-0" />
                  Mode lihat saja: kamu bisa melihat seluruh data, tetapi tidak bisa menambah, mengubah, atau menghapus.
                </div>
              )}
              <div className="text-right leading-tight">
                <p className="text-sm font-medium text-slate-900">{currentUser.name}</p>
                <p className="text-[11px] text-slate-500">
                  {currentUser.role === 'viewer' ? 'Mode lihat saja' : <>Kelola <span className="capitalize">{ROLE_LABEL[currentUser.role]}</span></>}
                </p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-600 text-sm font-semibold text-white">
                {currentUser.name.trim().charAt(0).toUpperCase()}
              </span>
              {currentUser.name === OWNER_NAME && (
                <button
                  onClick={logoutAllDevices}
                  title="Cabut semua perangkat lain"
                  className="rounded-lg border border-red-300 p-1.5 text-red-500 transition-all hover:bg-red-50 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
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
          {currentUser?.role === 'viewer' && (
            <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 md:px-8 lg:hidden">
              <Eye className="h-4 w-4 shrink-0" />
              Mode lihat saja: kamu bisa melihat seluruh data, tetapi tidak bisa menambah, mengubah, atau menghapus.
            </div>
          )}
          <div
            key={pathname}
            className={`px-4 py-6 md:px-8 md:py-8 animate-fade-in ${
              pathname === '/dankelola' ||
              pathname.startsWith('/dankelola/ticket/tipe') ||
              pathname.startsWith('/dankelola/ticket/periode') ||
              pathname.startsWith('/dankelola/ticket/tahap') ||
              pathname.startsWith('/dankelola/ticket/modal') ||
              pathname.startsWith('/dankelola/ticket/penjualan') ||
              pathname.startsWith('/dankelola/ticket/checkin') ||
              pathname.startsWith('/dankelola/merchandise') ||
              pathname.startsWith('/dankelola/tenants') ||
              pathname.startsWith('/dankelola/laporan') ||
              pathname.startsWith('/dankelola/monitoring') ||
              pathname.startsWith('/dankelola/audit') ||
               pathname.startsWith('/dankelola/pengaturan/qris') ||
               pathname.startsWith('/dankelola/pengaturan/tenant')
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
