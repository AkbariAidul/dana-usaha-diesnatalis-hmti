'use client'
import { useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowRight, Globe, Lock } from 'lucide-react'
import { Turnstile, type TurnstileHandle } from '@/components/turnstile'

const TURNSTILE_ENABLED = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const turnstileRef = useRef<TurnstileHandle>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (TURNSTILE_ENABLED && !turnstileToken) {
      toast.error('Selesaikan verifikasi keamanan dulu')
      turnstileRef.current?.reset()
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, turnstile_token: turnstileToken }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast.error(err?.error || 'PIN salah')
        return
      }
      const data = await res.json()
      sessionStorage.setItem('dashboard_welcome', JSON.stringify(data.user))
      router.replace('/dankelola')
      router.refresh()
    } catch {
      toast.error('Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary-50 via-white to-purple-50 px-4 py-10">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-purple-200/40 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-slate-200/70 bg-white/90 p-8 shadow-xl shadow-primary-600/10 backdrop-blur">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/logo-dies.png"
            alt="Logo In4Days XI"
            width={140}
            height={47}
            priority
            className="h-auto w-32 rounded-xl"
          />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[#111827]">Dashboard Pengelolaan</h1>
          <p className="mt-1 text-sm text-[#64748B]">Dana Usaha HMTI · In4Days XI</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="pin" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[#64748B]">
              PIN Akses
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                placeholder="••••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
                autoFocus
                required
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-center text-lg tracking-[0.4em] text-[#111827] outline-none transition focus:border-primary-400 focus:ring-4 focus:ring-primary-500/15"
              />
            </div>
          </div>

          {TURNSTILE_ENABLED && (
            <Turnstile ref={turnstileRef} onToken={setTurnstileToken} />
          )}
          <button
            type="submit"
            disabled={loading || (TURNSTILE_ENABLED && !turnstileToken)}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Memverifikasi...' : TURNSTILE_ENABLED && !turnstileToken ? 'Memuat verifikasi…' : 'Masuk'}
            {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          </button>
        </form>

        <Link
          href="/"
          className="mt-6 flex items-center justify-center gap-2 text-sm text-[#64748B] transition-colors hover:text-primary-700"
        >
          <Globe className="h-4 w-4" />
          Kembali ke halaman publik
        </Link>
      </div>
    </div>
  )
}
