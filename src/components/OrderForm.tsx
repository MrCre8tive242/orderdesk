import { FormEvent, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { findOrCreateCustomer, useCustomers } from '../hooks/useCustomers'
import { addDays, nextWeekday, today } from '../lib/dates'
import { PRODUCT_TYPES, SOURCES, STATUSES, statusLabel, type Customer, type Order, type OrderStatus } from '../lib/types'

export type OrderFormInitial = Partial<Order> & {
  customer_name?: string | null
  phone?: string | null
  email?: string | null
}

const field = 'w-full min-h-[44px] border rounded-lg px-3 bg-white'
const chip = 'min-h-[44px] px-3 rounded-lg bg-slate-100 text-sm font-medium'

export default function OrderForm({ initial, onSaved }: { initial?: OrderFormInitial; onSaved: (id: string) => void }) {
  const qc = useQueryClient()
  const { data: customers = [] } = useCustomers()
  const [f, setF] = useState({
    customer_name: initial?.customer_name ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    title: initial?.title ?? '',
    details: initial?.details ?? '',
    product_type: initial?.product_type ?? 'shirt',
    quantity: String(initial?.quantity ?? 1),
    price: String(initial?.price ?? 0),
    due_date: initial?.due_date ?? '',
    status: (initial?.status ?? 'inquiry') as OrderStatus,
    source: initial?.source ?? 'whatsapp',
  })
  // set when the customer is known (editing, or picked from suggestions); cleared when name/phone is retyped
  const [customerId, setCustomerId] = useState<string | null>(initial?.customer_id ?? null)
  // a pasted draft has a name/phone but no id yet: offer matches right away
  const [suggestOpen, setSuggestOpen] = useState(!initial?.customer_id && !!(initial?.customer_name || initial?.phone))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const setWho = (k: 'customer_name' | 'phone') => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value })
    setCustomerId(null)
    setSuggestOpen(true)
  }

  const nameQ = f.customer_name.trim().toLowerCase()
  const phoneQ = f.phone.replace(/\D/g, '')
  const matches = customerId || (nameQ.length < 2 && phoneQ.length < 3) ? [] : customers.filter((c) =>
    (nameQ.length >= 2 && c.name.toLowerCase().includes(nameQ)) ||
    (phoneQ.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(phoneQ))).slice(0, 5)

  function pick(c: Customer) {
    setF({ ...f, customer_name: c.name, phone: c.phone ?? '', email: c.email ?? '' })
    setCustomerId(c.id)
    setSuggestOpen(false)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      let customer_id = customerId
      if (!customer_id && (f.customer_name.trim() || f.phone.trim())) {
        customer_id = await findOrCreateCustomer({
          name: f.customer_name || f.phone, phone: f.phone, email: f.email,
        })
      }
      const row = {
        customer_id,
        title: f.title.trim(),
        details: f.details || null,
        product_type: f.product_type || null,
        quantity: parseInt(f.quantity, 10) || 1,
        price: parseFloat(f.price) || 0,
        due_date: f.due_date || null,
        status: f.status,
        source: f.source || null,
        delivered_at: f.status === 'delivered' ? initial?.delivered_at ?? new Date().toISOString() : null,
      }
      const q = initial?.id
        ? supabase.from('orders').update(row).eq('id', initial.id).select('id').single()
        : supabase.from('orders').insert(row).select('id').single()
      const { data, error } = await q
      if (error) throw error
      await qc.invalidateQueries()
      onSaved(data.id)
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const label = 'block text-sm text-slate-600 space-y-1'
  const dueChips: [string, string][] = [
    ['Fri', nextWeekday(5)], ['+1 week', addDays(today(), 7)], ['+2 weeks', addDays(today(), 14)],
  ]
  return (
    <form onSubmit={submit} className="bg-white rounded-xl shadow p-4 grid grid-cols-2 gap-3">
      <label className={`${label} col-span-2`}>Title
        <input required className={field} value={f.title} onChange={set('title')} placeholder="12 Junkanoo crew shirts" /></label>
      <label className={label}>Customer name
        <input className={field} autoComplete="off" value={f.customer_name} onChange={setWho('customer_name')} /></label>
      <label className={label}>Phone
        <input className={field} inputMode="tel" autoComplete="off" value={f.phone} onChange={setWho('phone')} /></label>
      {suggestOpen && matches.length > 0 && (
        <div className="col-span-2 border rounded-lg divide-y">
          <p className="px-3 py-1 text-xs text-slate-500">Existing customer?</p>
          {matches.map((c) => (
            <button type="button" key={c.id} onClick={() => pick(c)} className="w-full min-h-[44px] px-3 text-left">
              <span className="font-medium">{c.name}</span> <span className="text-sm text-slate-500">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
      {customerId && <p className="col-span-2 -mt-2 text-xs text-green-700">✓ Existing customer</p>}
      <label className={`${label} col-span-2`}>Email
        <input className={field} type="email" value={f.email} onChange={set('email')} /></label>
      <label className={`${label} col-span-2`}>Details
        <textarea className={`${field} py-2`} rows={5} value={f.details} onChange={set('details')} /></label>
      <label className={label}>Product
        <select className={field} value={f.product_type} onChange={set('product_type')}>
          {PRODUCT_TYPES.map((p) => <option key={p}>{p}</option>)}</select></label>
      <label className={label}>Quantity
        <input className={field} type="number" min={1} inputMode="numeric" value={f.quantity} onChange={set('quantity')} /></label>
      <label className={label}>Price ($)
        <input className={field} type="number" min={0} step="0.01" inputMode="decimal" value={f.price} onChange={set('price')} /></label>
      <label className={label}>Due date
        <input className={field} type="date" value={f.due_date} onChange={set('due_date')} /></label>
      <div className="col-span-2 flex flex-wrap gap-2 -mt-1">
        {dueChips.map(([t, d]) => (
          <button type="button" key={t} onClick={() => setF({ ...f, due_date: d })}
            className={`${chip} ${f.due_date === d ? 'bg-indigo-100 text-indigo-700' : ''}`}>{t}</button>
        ))}
      </div>
      <label className={label}>Status
        <select className={field} value={f.status} onChange={set('status')}>
          {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select></label>
      <label className={label}>Source
        <select className={field} value={f.source} onChange={set('source')}>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
      {err && <p className="col-span-2 text-red-600 text-sm">{err}</p>}
      <button disabled={busy} className="col-span-2 min-h-[44px] rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50">
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
