import { useQueryClient } from '@tanstack/react-query'
import { usePayments } from '../hooks/usePayments'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../lib/money'
import { formatDate } from '../lib/dates'

export default function PaymentList({ orderId }: { orderId: string }) {
  const qc = useQueryClient()
  const { data } = usePayments(orderId)

  async function remove(id: string) {
    if (!confirm('Delete this payment?')) return
    await supabase.from('payments').delete().eq('id', id)
    qc.invalidateQueries()
  }

  if (!data?.length) return <p className="text-sm text-slate-500">No payments yet.</p>
  return (
    <ul className="divide-y">
      {data.map((p) => (
        <li key={p.id} className="flex items-center justify-between py-2 text-sm">
          <span>
            {formatMoney(p.amount)} · <span className="capitalize">{p.method?.replace('_', ' ')}</span> · {formatDate(p.paid_at)}
            {p.reference && <span className="text-slate-500"> · {p.reference}</span>}
          </span>
          <button onClick={() => remove(p.id)} className="min-h-[44px] min-w-[44px] text-red-600" aria-label="Delete payment">✕</button>
        </li>
      ))}
    </ul>
  )
}
