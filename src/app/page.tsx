import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { ArrowRight, LayoutDashboard, ShoppingBag, Store, Ticket } from 'lucide-react'
import { SESSION_COOKIE, verifySession } from '@/lib/session'

const services = [
  { no: '01', title: 'Daftar Tenant', desc: 'Buka peluang usahamu di In4Days XI.', href: '/daftar-tenant', icon: Store },
  { no: '02', title: 'PO Merchandise', desc: 'Dapatkan merchandise resmi In4Days XI.', href: '/po-merchandise', icon: ShoppingBag },
  { no: '03', title: 'Beli Tiket', desc: 'Jadilah bagian dari kemeriahannya.', href: '/beli-tiket', icon: Ticket },
]

export default async function Home() {
  const authed = !!(await verifySession((await cookies()).get(SESSION_COOKIE)?.value))

  return (
    <div className="relative min-h-screen bg-white text-[#111827]">
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="flex h-[72px] w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo-dies.png"
              alt="Logo In4Days XI"
              width={112}
              height={37}
              priority
              className="h-auto w-20 shrink-0 rounded-lg sm:w-28"
            />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold leading-tight text-[#111827] sm:text-base">Dana Usaha HMTI</p>
              <p className="truncate text-[11px] leading-tight text-[#64748B]">In4Days XI · Campus Festival</p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/lacak"
              className="shrink-0 whitespace-nowrap rounded-xl bg-primary-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              Lacak Pesanan
            </Link>
          </div>
        </div>
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
                <span className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-700 shadow-sm shadow-primary-600/5 backdrop-blur">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-600" />
                  </span>
                  In4Days XI · Dies Natalis HMTI
                </span>

                <h1 className="mt-5 text-balance text-[clamp(2.1rem,3.6vw,3.5rem)] font-semibold leading-[1.04] tracking-tight text-[#111827]">
                  Jadilah Bagian dari{' '}
                  <span className="bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">In4Days XI</span>
                </h1>
                <p className="mt-4 max-w-md text-[clamp(0.95rem,1.05vw,1.05rem)] leading-relaxed text-[#64748B]">
                  Rayakan kebersamaan, dukung kreativitas, dan temukan pengalamanmu di Dies Natalis HMTI ke-11.
                </p>

                <div className="mt-7 space-y-3">
                  {services.map((service) => {
                    const Icon = service.icon
                    return (
                      <Link
                        key={service.href}
                        href={service.href}
                        className="group flex min-h-[76px] items-center gap-4 rounded-2xl border border-slate-200/70 bg-white/90 px-4 py-3 shadow-sm shadow-slate-200/40 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-600/10"
                      >
                        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors duration-200 group-hover:bg-primary-600 group-hover:text-white">
                          <Icon className="h-5 w-5" />
                          <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-white text-[9px] font-bold tabular-nums text-primary-600 ring-1 ring-primary-100">
                            {service.no}
                          </span>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#111827]">{service.title}</p>
                          <p className="mt-0.5 text-xs leading-snug text-[#64748B] sm:text-sm">{service.desc}</p>
                        </div>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-50 text-primary-600 transition-all duration-200 group-hover:bg-primary-600 group-hover:text-white">
                          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {authed && (
        <Link
          href="/dankelola"
          className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/90 px-4 py-2.5 text-sm font-medium text-primary-700 shadow-lg shadow-slate-900/10 backdrop-blur transition-colors hover:bg-primary-600 hover:text-white"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
      )}

      <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex items-center gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">
          Powered by
        </p>
        <div className="relative h-6 w-14 shrink-0 opacity-70">
          <Image
            src="/shift-hd.webp"
            alt="Shift"
            fill
            sizes="56px"
            className="object-contain object-right"
          />
        </div>
      </div>
    </div>
  )
}
