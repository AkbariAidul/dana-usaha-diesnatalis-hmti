export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          <td colSpan={cols} className="px-6 py-3">
            <div className="skeleton h-4 w-full" />
          </td>
        </tr>
      ))}
    </>
  )
}

export function CardsSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/40">
          <div className="skeleton mb-3 h-3 w-20" />
          <div className="skeleton h-6 w-28" />
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-40 w-full" />
      <div className="skeleton h-56 w-full" />
    </div>
  )
}
