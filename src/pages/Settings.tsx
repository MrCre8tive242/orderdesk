import { supabase } from '../lib/supabase'
import { STATUSES, statusLabel } from '../lib/types'
import StatusBadge from '../components/StatusBadge'

const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

async function exportCsv() {
  const { data, error } = await supabase.from('order_summary').select('*').order('order_no')
  if (error || !data?.length) return alert(error?.message ?? 'No orders to export.')
  const cols = Object.keys(data[0])
  const csv = [cols.join(','), ...data.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'orders.csv'
  a.click()
}

export default function Settings() {
  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-xl font-bold">Settings</h1>
      <section className="bg-white rounded-xl shadow p-4 space-y-2">
        <h2 className="font-semibold">Statuses</h2>
        <div className="flex gap-2 flex-wrap">{STATUSES.map((s) => <StatusBadge key={s} status={s} />)}</div>
        <p className="text-sm text-slate-500">Order: {STATUSES.map(statusLabel).join(' → ')}</p>
      </section>
      <button onClick={exportCsv} className="w-full min-h-[44px] rounded-lg bg-indigo-600 text-white font-medium">Export orders (CSV)</button>
      <button onClick={() => supabase.auth.signOut()} className="w-full min-h-[44px] rounded-lg bg-slate-100">Sign out</button>
    </div>
  )
}
