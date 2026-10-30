'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronRight, LogOut, Menu, X, Home } from 'lucide-react'
import { prefetch } from '../api'
import { menuConfig } from '@/lib/menu'

function isPathActive(pathname: string, href: string) {
  if (href === '/dankelola') return pathname === '/dankelola'
  if (href === '/dankelola/tenants') return pathname === '/dankelola/tenants'
  return pathname.startsWith(href)
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
  const parts = pathname.split('/').filter((s): s is string => Boolean(s))
  const breadcrumbs = [{ label: 'Dashboard', href: '/dankelola' }]
  
  let currentPath = ''
  for (const part of parts.slice(1)) {
    currentPath += `/${part}`
    const label = part.charAt(0).toUpperCase() + part.slice(1)
    breadcrumbs.push({ label, href: currentPath })
  }
  return breadcrumbs
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const breadcrumbs = getBreadcrumbs(pathname)

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

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' } as RequestInit)
    router.push('/dankelola/login')
  }

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const nav = (
    <nav className="flex flex-col gap-0.5 px-3 py-2" aria-label="Navigasi dashboard">
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
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                active
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
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
                  ? 'text-indigo-700 bg-indigo-50/50'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 transition-colors ${groupActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
              <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-slate-500 group-hover:text-slate-700">{group.label}</span>
              <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''} ${groupActive ? 'text-indigo-500' : 'text-slate-400'}`} />
            </button>
            {isOpen && group.children && (
              <div className="ml-7 flex flex-col gap-0.5 border-l-2 border-slate-100 pl-3 mt-0.5 pb-1">
                {group.children.map((child) => {
                  const childActive = isPathActive(pathname, child.href)
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setOpen(false)}
                      aria-current={childActive ? 'page' : undefined}
                      className={`rounded-md px-2.5 py-1.5 text-sm transition-all duration-150 ${
                        childActive
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      {child.label}
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

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex-1 overflow-y-auto pt-2 pb-4">{nav}</div>
      <div className="border-t border-slate-100 px-3 py-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Keluar</span>
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} aria-label="Buka menu" className="mr-2 rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2.5">
              <Image src="/logo-hima-ti.png" alt="Logo" width={32} height={32} className="rounded-lg" />
              <div className="leading-tight">
                <p className="text-sm font-semibold text-slate-900">Dana Usaha HMTI</p>
                <p className="text-[10px] text-slate-500">Dies Natalis</p>
              </div>
            </div>
          </div>
          
          {/* Breadcrumb */}
          <nav className="hidden md:flex items-center gap-2 text-sm" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.href} className="flex items-center gap-2">
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                {idx === breadcrumbs.length - 1 ? (
                  <span className="text-slate-900 font-medium">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="text-slate-500 hover:text-slate-700 transition-colors">
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Image src="/logo-hima-ti.png" alt="Logo" width={28} height={28} className="rounded-lg" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-900">Dana Usaha</p>
                  <p className="text-[10px] text-slate-500">Dies Natalis</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:w-56 md:border-r md:border-slate-200 md:bg-white md:shadow-sm">{sidebarContent}</aside>

      {/* Main content */}
      <main className="md:pl-56">
        <div key={pathname} className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8 animate-fade-in">
          {/* Mobile breadcrumb */}
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
  )
}