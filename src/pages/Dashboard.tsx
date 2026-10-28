import { Link } from 'react-router-dom'
import { useOrders } from '../hooks/useOrders'
import { addDays, formatDate, isOverdue, today } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { OPEN_STATUSES, type OrderSummary } from '../lib/types'
import StatusBadge from '../components/StatusBadge'

function Row({ o, red }: { o: OrderSummary; red?: boolean }) {
  return (
    <Link to={`/orders/${o.id}`} className="flex items-center justify-between gap-2 min-h-[44px] py-2 border-b last:border-0">
      <span className="min-w-0">
        <span className="font-medium">#{o.order_no}</span> {o.title}
        <span className={`block text-sm ${red ? 'text-red-600' : 'text-slate-500'}`}>{o.customer_name} · {formatDate(o.due_date)}</span>
      </span>
      <StatusBadge status={o.status} />
    </Link>
  )
}

export default function Dashboard() {
  const { data: open = [] } = useOrders({ status: OPEN_STATUSES })
  const t = today()
  const next7 = addDays(t, 7)
  const overdue = open.filter((o) => isOverdue(o.due_date, o.status))
  const soon = open.filter((o) => o.due_date && o.due_date >= t && o.due_date <= next7)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
  const outstanding = open.reduce((s, o) => s + Math.max(o.balance, 0), 0)
  const stats: [string, string | number][] = [
    ['Open orders', open.length], ['Due this week', soon.length],
    ['Overdue', overdue.length], ['Outstanding', formatMoney(outstanding)],
  ]
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-bold">This week</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="bg-white rounded-xl shadow p-3">
            <div className="text-sm text-slate-500">{k}</div>
            <div className={`text-2xl font-bold ${k === 'Overdue' && overdue.length ? 'text-red-600' : ''}`}>{v}</div>
          </div>
        ))}
      </div>
      {overdue.length > 0 && (
        <section className="bg-white rounded-xl shadow p-4">
          <h2 className="font-semibold text-red-600">Overdue</h2>
          {overdue.map((o) => <Row key={o.id} o={o} red />)}
        </section>
      )}
      <section className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold">Due in the next 7 days</h2>
        {soon.length ? soon.map((o) => <Row key={o.id} o={o} />) : <p className="text-slate-500 text-sm">Nothing due.</p>}
      </section>
    </div>
  )
}
