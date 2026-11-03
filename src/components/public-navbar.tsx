import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

export type Crumb = { label: string; href?: string }

type PublicNavbarProps = {
  title: string
  subtitle?: string
  maxWidth?: string
  sticky?: boolean
  action?: ReactNode
}

const actionClass =
  'inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 sm:text-sm'

export function PublicNavbar({
  title,
  subtitle = 'In4Days XI · Dies Natalis HMTI',
  maxWidth = 'max-w-5xl',
  sticky = true,
  action,
}: PublicNavbarProps) {
  const aksi =
    action === undefined ? (
      <Link href="/lacak" className={actionClass}>
        Lacak Pesanan
      </Link>
    ) : (
      action
    )

  return (
    <header className={`${sticky ? 'sticky top-0' : ''} z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl`}>
      <div className={`mx-auto ${maxWidth} px-4 py-3 sm:px-6`}>
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo-dies.png"
              alt="Logo In4Days XI"
              width={112}
              height={37}
              priority
              className="h-auto w-20 shrink-0 sm:w-24"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
              {subtitle && <p className="hidden truncate text-xs text-slate-500 sm:block">{subtitle}</p>}
            </div>
          </Link>
          {aksi}
        </div>
      </div>
    </header>
  )
}

export function PublicBreadcrumb({ items, className = '' }: { items: Crumb[]; className?: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex flex-wrap items-center gap-1.5 text-xs text-slate-500 ${className}`}
    >
      {items.map((item, idx) => {
        const last = idx === items.length - 1
        return (
          <span key={`${item.label}-${idx}`} className="flex shrink-0 items-center gap-1.5">
            {idx > 0 && (
              <span aria-hidden="true" className="text-slate-300">
                /
              </span>
            )}
            {!last && item.href ? (
              <Link href={item.href} className="transition hover:text-primary-700">
                {item.label}
              </Link>
            ) : (
              <span className={last ? 'font-medium text-slate-700' : ''}>{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
