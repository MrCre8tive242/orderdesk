import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../lib/money'
import { formatDate } from '../lib/dates'
import type { Customer, OrderSummary } from '../lib/types'
import StatusBadge from '../components/StatusBadge'

export default function CustomerDetail() {
  const { id } = useParams()
  const { data } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const c = await supabase.from('customers').select('*').eq('id', id!).single()
      const o = await supabase.from('order_summary').select('*').eq('customer_id', id!).order('created_at', { ascending: false })
      if (c.error) throw c.error
      if (o.error) throw o.error
      return { customer: c.data as Customer, orders: o.data as OrderSummary[] }
    },
  })
  if (!data) return <p>Loading…</p>
  const { customer: c, orders } = data
  const spent = orders.reduce((s, o) => s + o.paid, 0)
  const owed = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + Math.max(o.balance, 0), 0)
  return (
    <div className="space-y-3 max-w-2xl">
      <h1 className="text-xl font-bold">{c.name}</h1>
      <p className="text-sm text-slate-600">{[c.phone, c.email].filter(Boolean).join(' · ')}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl shadow p-3"><div className="text-sm text-slate-500">Total spent</div><div className="text-xl font-bold">{formatMoney(spent)}</div></div>
        <div className="bg-white rounded-xl shadow p-3"><div className="text-sm text-slate-500">Outstanding</div><div className="text-xl font-bold text-red-600">{formatMoney(owed)}</div></div>
      </div>
      <div className="bg-white rounded-xl shadow divide-y">
        {orders.map((o) => (
          <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between min-h-[44px] p-3">
            <span>#{o.order_no} {o.title}<span className="block text-sm text-slate-500">{formatDate(o.due_date)} · {formatMoney(o.price)}</span></span>
            <StatusBadge status={o.status} />
          </Link>
        ))}
      </div>
    </div>
  )
}
