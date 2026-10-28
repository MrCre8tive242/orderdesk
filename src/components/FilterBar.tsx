import { OrderFilters } from '../hooks/useOrders'
import { OPEN_STATUSES, STATUSES, statusLabel, type OrderStatus, type PaymentState } from '../lib/types'
import { addDays, today, weekRange } from '../lib/dates'

const input = 'min-h-[44px] border rounded-lg px-3 bg-white'

export default function FilterBar({ value, onChange }: { value: OrderFilters; onChange: (f: OrderFilters) => void }) {
  const set = (p: Partial<OrderFilters>) => onChange({ ...value, ...p })
  const presets: [string, OrderFilters][] = [
    ['All open', { status: OPEN_STATUSES }],
    ['Unpaid balance', { paymentState: 'unpaid' }],
    ['Due this week', { status: OPEN_STATUSES, dueFrom: weekRange().from, dueTo: addDays(today(), 7) }],
  ]
  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {presets.map(([label, f]) => (
          <button key={label} onClick={() => onChange(f)} className="min-h-[44px] px-3 rounded-lg bg-indigo-50 text-indigo-700 text-sm font-medium">
            {label}
          </button>
        ))}
        <button onClick={() => onChange({})} className="min-h-[44px] px-3 rounded-lg text-sm text-slate-600">Clear</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <input className={`${input} col-span-2 md:col-span-1`} placeholder="Search…" value={value.search ?? ''}
          onChange={(e) => set({ search: e.target.value })} />
        <select className={input} value={value.status?.length === 1 ? value.status[0] : ''}
          onChange={(e) => set({ status: e.target.value ? [e.target.value as OrderStatus] : undefined })}>
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <select className={input} value={value.paymentState ?? ''}
          onChange={(e) => set({ paymentState: (e.target.value || undefined) as PaymentState | undefined })}>
          <option value="">Any payment</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
        <input type="date" className={input} value={value.dueFrom ?? ''} onChange={(e) => set({ dueFrom: e.target.value || undefined })} />
        <input type="date" className={input} value={value.dueTo ?? ''} onChange={(e) => set({ dueTo: e.target.value || undefined })} />
      </div>
    </div>
  )
}
