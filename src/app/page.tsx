import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { ArrowRight, LayoutDashboard } from 'lucide-react'

const services = [
  { no: '01', title: 'Daftar Tenant', desc: 'Buka peluang usahamu di In4Days XI.', href: '/daftar-tenant' },
  { no: '02', title: 'PO Merchandise', desc: 'Dapatkan merchandise resmi In4Days XI.', href: '/po-merchandise' },
  { no: '03', title: 'Beli Tiket', desc: 'Jadilah bagian dari kemeriahannya.', href: '/beli-tiket' },
]

const navLinks = [
  { label: 'Lacak Pesanan', href: '/lacak' },
  { label: 'Info Tenant', href: '/tenant-info' },
  { label: 'Merchandise', href: '/merchandise' },
  { label: 'Ticket', href: '/ticket' },
]

export default async function Home() {
  const token = process.env.DASHBOARD_SESSION_SECRET || (process.env.NODE_ENV !== 'production' ? 'authenticated' : '')
  const authed = !!token && (await cookies()).get('dashboard_session')?.value === token

  return (
    <div className="relative min-h-screen bg-white text-[#111827]">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo-dies.png"
              alt="Logo In4Days XI"
              width={112}
              height={37}
              priority
              className="h-auto w-20 shrink-0 rounded-lg sm:w-28"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight text-[#111827] sm:text-base">Dana Usaha HMTI</p>
              <p className="truncate text-[11px] leading-tight text-[#64748B]">In4Days XI · Campus Festival</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 text-sm md:flex">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-3 py-2 text-[#64748B] transition-colors hover:bg-[#F5F0FF] hover:text-[#6D28D9]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {authed && (
              <Link
                href="/dankelola"
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            )}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-4 py-2 text-sm md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-lg px-3 py-1.5 text-[#64748B] hover:bg-[#F5F0FF] hover:text-[#6D28D9]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="relative w-full lg:h-[100dvh]">
        <section className="relative w-full overflow-hidden lg:h-full">
          <div className="relative aspect-video w-full lg:absolute lg:inset-0 lg:z-0 lg:aspect-auto lg:h-full">
            <div className="hero-photo absolute inset-0">
              <Image
                src="/hero.png"
                alt="Dokumentasi dua orang di area festival In4Days XI"
                fill
                priority
                className="object-contain object-left"
                sizes="100vw"
              />
            </div>
          </div>

          <div className="hero-content-fade relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:h-full lg:px-8">
            <div className="grid w-full items-center gap-8 py-8 sm:py-10 lg:h-full lg:grid-cols-[55fr_45fr] lg:gap-12 lg:py-6">
              <div className="relative order-2 min-w-0 lg:col-start-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-600">In4Days XI · Dies Natalis HMTI</p>
                <h1 className="mt-3 text-balance text-[clamp(2rem,3.4vw,3.25rem)] font-semibold leading-[1.05] tracking-tight text-[#111827]">
                  Jadilah Bagian dari In4Days XI
                </h1>
                <p className="mt-4 max-w-md text-[clamp(0.95rem,1.05vw,1.05rem)] leading-relaxed text-[#64748B]">
                  Rayakan kebersamaan, dukung kreativitas, dan temukan pengalamanmu di Dies Natalis HMTI ke-11.
                </p>

                <div className="mt-6 space-y-3">
                  {services.map((service) => (
                    <Link
                      key={service.href}
                      href={service.href}
                      className="group flex min-h-[76px] items-center gap-4 rounded-2xl border border-[#E9D5FF] bg-white px-4 py-3 transition-all duration-200 hover:border-primary-600 hover:bg-[#F5F0FF]/70"
                    >
                      <span className="w-7 shrink-0 text-xs font-semibold tabular-nums text-primary-600">{service.no}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#111827]">{service.title}</p>
                        <p className="mt-0.5 text-xs leading-snug text-[#64748B] sm:text-sm">{service.desc}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-primary-600 transition-transform duration-200 group-hover:translate-x-1" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
