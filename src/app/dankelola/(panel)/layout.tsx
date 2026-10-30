'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronRight, LogOut, Menu, X } from 'lucide-react'
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

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

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
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/dankelola/login')
  }

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const nav = (
    <nav className="mt-2 flex flex-col gap-1 px-4" aria-label="Navigasi dashboard">
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
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-indigo-600/10 text-indigo-600'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {active && <span className="absolute left-0 h-6 w-1 rounded-r-full bg-indigo-600" />}
              <Icon className={`h-[18px] w-[18px] transition-colors ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
              <span className="flex-1">{group.label}</span>
            </Link>
          )
        }

        const isOpen = openGroups[group.key] ?? false
        const hasActiveChild = group.children?.some((child) => isPathActive(pathname, child.href)) ?? false
        const groupActive = hasActiveChild
        const contentId = `menu-${group.key}`

        return (
          <div key={group.key} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggleGroup(group.key)}
              aria-expanded={isOpen}
              aria-controls={contentId}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ${
                groupActive
                  ? 'text-indigo-600'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {groupActive && <span className="absolute left-0 h-6 w-1 rounded-r-full bg-indigo-600" />}
              <Icon className={`h-[18px] w-[18px] transition-colors ${groupActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
              <span className="flex-1 uppercase tracking-wide text-xs font-semibold">{group.label}</span>
              <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''} ${groupActive ? 'text-indigo-500' : 'text-slate-400'}`} />
            </button>
            {isOpen && group.children && (
              <div id={contentId} className="relative ml-6 mt-1 flex flex-col gap-1 border-l border-slate-200/80 pl-4">
                {group.children.map((child) => {
                  const childActive = isPathActive(pathname, child.href)
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setOpen(false)}
                      aria-current={childActive ? 'page' : undefined}
                      className={`rounded-lg px-2.5 py-1.5 text-sm transition-all duration-200 ${
                        childActive
                          ? 'font-medium text-indigo-600'
                          : 'text-slate-500 hover:text-slate-900'
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
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-6">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-600 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20">DU</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">Dana Usaha HMTI</p>
          <p className="text-xs text-slate-500">Dana Usaha - Dies Natalis</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain pt-2 pb-3">{nav}</div>
      <div className="mt-auto border-t border-slate-200/70 px-4 py-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Keluar
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/70 bg-white/95 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20">DU</span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">Dana Usaha</p>
            <p className="text-[11px] text-slate-500">Dana Usaha - Dies Natalis</p>
          </div>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Buka menu" className="rounded-xl p-2 text-slate-600 hover:bg-slate-100">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:w-[276px] md:flex-col border-r border-slate-200/70 bg-white">{sidebarContent}</aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[284px] flex-col border-r border-slate-200/70 bg-white shadow-2xl">{sidebarContent}</aside>
        </div>
      )}

      <main className="md:pl-[276px]">
        <div key={pathname} className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-9 animate-fade-in">{children}</div>
      </main>
    </div>
  )
}
