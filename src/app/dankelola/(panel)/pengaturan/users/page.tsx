'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Save, Trash2 } from 'lucide-react'
import { getJSON, sendJSON } from '../../../api'
import { PageSkeleton } from '../../ui'

type DashboardUser = {
  name: string
  pin: string
  has_pin?: boolean
  role: 'pengelola' | 'viewer'
  aktif: boolean
  owner?: boolean
}

export default function KelolaUserPage() {
  const [users, setUsers] = useState<DashboardUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    getJSON<DashboardUser[]>('/api/dashboard-users')
      .then((data) => setUsers(data))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  function update(index: number, patch: Partial<DashboardUser>) {
    setUsers((list) => list.map((user, i) => (i === index ? { ...user, ...patch } : user)))
    setDirty(true)
  }

  function addUser() {
    setUsers((list) => [...list, { name: '', pin: '', role: 'pengelola', aktif: true }])
    setDirty(true)
  }

  function removeUser(index: number) {
    setUsers((list) => list.filter((_, i) => i !== index))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      await sendJSON('/api/dashboard-users', 'POST', { users })
      toast.success('Data user disimpan')
      setDirty(false)
      const data = await getJSON<DashboardUser[]>('/api/dashboard-users')
      setUsers(data)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageSkeleton />

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kelola User</h1>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>
      </div>
    )
  }

  const input = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/10 disabled:bg-slate-50 disabled:text-slate-500'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Kelola User</h1>
          <p className="text-sm text-slate-500">Atur nama, PIN, status aktif, dan peran pengguna dashboard. PIN lama tidak ditampilkan; kosongkan kolom PIN jika tidak ingin mengubah.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={addUser} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-primary-200 hover:text-primary-600">
            <Plus className="h-4 w-4" /> Tambah User
          </button>
          <button type="button" onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="hidden gap-3 border-b border-slate-100 px-5 py-3 text-xs font-medium text-slate-500 sm:grid sm:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
          <span>Nama</span>
          <span>PIN</span>
          <span>Peran</span>
          <span>Aktif</span>
          <span />
        </div>
        <div className="divide-y divide-slate-100">
          {users.map((user, index) => (
            <div key={index} className="grid gap-3 px-5 py-4 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto] sm:items-center">
              <div>
                {user.owner ? (
                  <div className="flex items-center gap-2">
                    <input className={input} value={user.name} disabled />
                    <span className="whitespace-nowrap rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">Pemilik</span>
                  </div>
                ) : (
                  <input className={input} value={user.name} onChange={(e) => update(index, { name: e.target.value })} placeholder="Nama user" />
                )}
              </div>
              <input
                className={input}
                value={user.pin}
                inputMode="numeric"
                autoComplete="new-password"
                onChange={(e) => update(index, { pin: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                placeholder={user.has_pin ? 'Kosongkan jika tetap' : 'PIN wajib'}
              />
              <select
                className={input}
                value={user.role}
                disabled={user.owner}
                onChange={(e) => update(index, { role: e.target.value === 'viewer' ? 'viewer' : 'pengelola' })}
              >
                <option value="pengelola">Pengelola</option>
                <option value="viewer">Pelihat</option>
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={user.aktif}
                  disabled={user.owner}
                  onChange={(e) => update(index, { aktif: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                {user.aktif ? 'Aktif' : 'Nonaktif'}
              </label>
              <button
                type="button"
                onClick={() => removeUser(index)}
                disabled={user.owner}
                title={user.owner ? 'Akun pemilik tidak dapat dihapus' : 'Hapus user'}
                className="justify-self-start rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
