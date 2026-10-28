import { useState } from 'react'
import { Link } from 'react-router-dom'
import FilterBar from '../components/FilterBar'
import MoneyCell from '../components/MoneyCell'
import StatusBadge from '../components/StatusBadge'
import { OrderFilters, useOrders } from '../hooks/useOrders'
import { formatDate, isOverdue } from '../lib/dates'
import { OPEN_STATUSES } from '../lib/types'

export default function Orders() {
  const [filters, setFilters] = useState<OrderFilters>({ status: OPEN_STATUSES })
  const { data, isLoading, error } = useOrders(filters)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Orders</h1>
        <Link to="/orders/new" className="min-h-[44px] px-4 inline-flex items-center rounded-lg bg-indigo-600 text-white font-medium">+ New</Link>
      </div>
      <FilterBar value={filters} onChange={setFilters} />
      {isLoading && <p>Loading…</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}
      {/* phone: stacked cards; the 8-column table only fits from md up */}
      <div className="md:hidden space-y-2">
        {data?.map((o) => (
          <Link key={o.id} to={`/orders/${o.id}`} className="block bg-white rounded-xl shadow p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium min-w-0"><span className="text-indigo-600">#{o.order_no}</span> {o.title}</span>
              <StatusBadge status={o.status} />
            </div>
            <div className="flex justify-between gap-2 mt-1 text-sm text-slate-500">
              <span className="min-w-0 truncate">
                {o.customer_name} · <span className={isOverdue(o.due_date, o.status) ? 'text-red-600 font-medium' : ''}>{formatDate(o.due_date)}</span>
              </span>
              <span className="whitespace-nowrap">Bal <MoneyCell value={o.balance} danger /></span>
            </div>
          </Link>
        ))}
        {data?.length === 0 && <p className="p-6 text-center text-slate-500">No orders match.</p>}
      </div>
      <div className="hidden md:block overflow-x-auto bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500 border-b">
            <tr>{['#', 'Customer', 'Title', 'Due', 'Price', 'Paid', 'Balance', 'Status'].map((h) => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody>
            {data?.map((o) => (
              <tr key={o.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="p-3"><Link className="text-indigo-600 font-medium inline-block min-h-[44px] leading-[44px]" to={`/orders/${o.id}`}>#{o.order_no}</Link></td>
                <td className="p-3 whitespace-nowrap">{o.customer_name}</td>
                <td className="p-3 min-w-[160px]">{o.title}</td>
                <td className={`p-3 whitespace-nowrap ${isOverdue(o.due_date, o.status) ? 'text-red-600 font-medium' : ''}`}>{formatDate(o.due_date)}</td>
                <td className="p-3"><MoneyCell value={o.price} /></td>
                <td className="p-3"><MoneyCell value={o.paid} /></td>
                <td className="p-3"><MoneyCell value={o.balance} danger /></td>
                <td className="p-3"><StatusBadge status={o.status} /></td>
              </tr>
            ))}
            {data?.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-500">No orders match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
