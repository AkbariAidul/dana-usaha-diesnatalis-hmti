import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

type Crumb = { label: string; href?: string }

type PublicNavbarProps = {
  title: string
  subtitle?: string
  crumbs?: Crumb[]
  maxWidth?: string
  sticky?: boolean
  action?: ReactNode
}

const actionClass =
  'inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 sm:text-sm'

export function PublicNavbar({
  title,
  subtitle = 'In4Days XI · Dies Natalis HMTI',
  crumbs = [],
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
        {crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mt-2 flex items-center gap-1.5 overflow-x-auto text-xs text-slate-500">
            {crumbs.map((crumb, idx) => {
              const last = idx === crumbs.length - 1
              return (
                <span key={`${crumb.label}-${idx}`} className="flex shrink-0 items-center gap-1.5">
                  {idx > 0 && (
                    <span aria-hidden="true" className="text-slate-300">
                      /
                    </span>
                  )}
                  {!last && crumb.href ? (
                    <Link href={crumb.href} className="transition hover:text-primary-700">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={last ? 'font-medium text-slate-700' : ''}>{crumb.label}</span>
                  )}
                </span>
              )
            })}
          </nav>
        )}
      </div>
    </header>
  )
}
