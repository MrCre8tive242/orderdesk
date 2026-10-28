import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCustomers } from '../hooks/useCustomers'

export default function Customers() {
  const { data = [], isLoading } = useCustomers()
  const [q, setQ] = useState('')
  const s = q.toLowerCase()
  const list = data.filter((c) => c.name.toLowerCase().includes(s) || (c.phone ?? '').includes(q))
  return (
    <div className="space-y-3 max-w-2xl">
      <h1 className="text-xl font-bold">Customers</h1>
      <input className="w-full min-h-[44px] border rounded-lg px-3 bg-white" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading && <p>Loading…</p>}
      <div className="bg-white rounded-xl shadow divide-y">
        {list.map((c) => (
          <Link key={c.id} to={`/customers/${c.id}`} className="block min-h-[44px] p-3">
            <span className="font-medium">{c.name}</span>
            <span className="block text-sm text-slate-500">{c.phone}</span>
          </Link>
        ))}
        {!list.length && !isLoading && <p className="p-4 text-slate-500">No customers.</p>}
      </div>
    </div>
  )
}
