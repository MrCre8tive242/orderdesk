import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useOrder } from '../hooks/useOrders'
import { supabase } from '../lib/supabase'
import { formatMoney } from '../lib/money'
import { formatDate } from '../lib/dates'
import { STATUSES, statusLabel, type OrderDraft, type OrderStatus } from '../lib/types'
import OrderForm, { OrderFormInitial } from '../components/OrderForm'
import PasteOrderDialog from '../components/PasteOrderDialog'
import PaymentList from '../components/PaymentList'
import AddPaymentDialog from '../components/AddPaymentDialog'
import AttachmentGrid from '../components/AttachmentGrid'

const card = 'bg-white rounded-xl shadow p-4 space-y-2'

function NewOrder() {
  const nav = useNavigate()
  const [draft, setDraft] = useState<OrderFormInitial | null>(null)
  return (
    <div className="space-y-3 max-w-2xl">
      <h1 className="text-xl font-bold">New order</h1>
      <PasteOrderDialog
        onDraft={(d: OrderDraft) =>
          setDraft({
            customer_name: d.customer_name, phone: d.phone, email: d.email,
            title: d.title ?? '', details: d.details, product_type: d.product_type ?? 'shirt',
            quantity: d.quantity ?? 1, price: d.price ?? 0, due_date: d.due_date, source: d.source ?? 'whatsapp',
          })
        }
      />
      {/* key remounts the form so a new draft refills it */}
      <OrderForm key={JSON.stringify(draft)} initial={draft ?? undefined} onSaved={(id) => nav(`/orders/${id}`)} />
    </div>
  )
}

export default function OrderDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { data: o, isLoading } = useOrder(id === 'new' ? undefined : id)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)

  if (id === 'new') return <NewOrder />
  if (isLoading || !o) return <p>Loading…</p>

  // wa.me needs the country code: 10-digit 242 numbers get the NANP "1"
  const wa = o.customer_phone && `https://wa.me/${o.customer_phone.replace(/\D/g, '').replace(/^(\d{10})$/, '1$1')}`
  const next = o.status === 'delivered' || o.status === 'cancelled' ? null : STATUSES[STATUSES.indexOf(o.status) + 1]
  const reminder = `Hi ${o.customer_name ?? ''}, a friendly reminder that order #${o.order_no} (${o.title}) has a balance of ${formatMoney(o.balance)}${o.due_date ? `, due ${formatDate(o.due_date)}` : ''}. Thank you!`

  async function markPaid() {
    if (!confirm(`Record ${formatMoney(o!.balance)} cash payment?`)) return
    const { error } = await supabase.from('payments').insert({ order_id: o!.id, amount: o!.balance, method: 'cash' })
    if (error) return alert(error.message)
    qc.invalidateQueries()
  }

  async function copyReminder() {
    await navigator.clipboard.writeText(reminder)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function setStatus(status: OrderStatus) {
    await supabase.from('orders').update({
      status, delivered_at: status === 'delivered' ? new Date().toISOString() : null,
    }).eq('id', o!.id)
    qc.invalidateQueries()
  }

  if (editing)
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-xl font-bold">Edit #{o.order_no}</h1>
        <OrderForm
          initial={{ ...o, customer_name: o.customer_name, phone: o.customer_phone }}
          onSaved={() => setEditing(false)}
        />
        <button onClick={() => setEditing(false)} className="min-h-[44px] px-4 rounded-lg bg-slate-100">Cancel</button>
      </div>
    )

  return (
    <div className="space-y-3 max-w-2xl">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">#{o.order_no} {o.title}</h1>
          {o.customer_id && <Link to={`/customers/${o.customer_id}`} className="text-indigo-600">{o.customer_name}</Link>}
          {wa && <a href={wa} className="ml-2 text-sm text-slate-500">{o.customer_phone}</a>}
        </div>
        <button onClick={() => setEditing(true)} className="min-h-[44px] px-4 rounded-lg bg-slate-100">Edit</button>
      </div>

      <div className={card}>
        <div className="flex flex-wrap gap-2">
          <select value={o.status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className="min-h-[44px] border rounded-lg px-3 capitalize">
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          {next && (
            <button onClick={() => setStatus(next)} className="min-h-[44px] px-4 rounded-lg bg-indigo-600 text-white font-medium capitalize">
              Next: {statusLabel(next)} →
            </button>
          )}
        </div>
        <p className="text-sm">Due: {formatDate(o.due_date)} · {o.quantity} × {o.product_type ?? '—'} · via {o.source ?? '—'}</p>
        {o.details && <p className="whitespace-pre-wrap">{o.details}</p>}
      </div>

      <div className={card}>
        <h2 className="font-semibold">Payments</h2>
        <p className="text-sm">
          Price {formatMoney(o.price)} · Paid {formatMoney(o.paid)} ·{' '}
          <span className={o.balance > 0 ? 'text-red-600 font-medium' : ''}>Balance {formatMoney(o.balance)}</span>
          <span className="ml-2 capitalize text-slate-500">({o.payment_state})</span>
        </p>
        <PaymentList orderId={o.id} />
        {o.balance > 0 && (
          <div className="flex flex-wrap gap-2">
            <button onClick={markPaid} className="min-h-[44px] px-4 rounded-lg bg-green-600 text-white font-medium">Mark paid</button>
            {wa && (
              <a href={`${wa}?text=${encodeURIComponent(reminder)}`} target="_blank" rel="noreferrer"
                className="min-h-[44px] px-4 inline-flex items-center rounded-lg bg-slate-100 font-medium">Remind on WhatsApp</a>
            )}
            <button onClick={copyReminder} className="min-h-[44px] px-4 rounded-lg bg-slate-100 font-medium">
              {copied ? 'Copied ✓' : 'Copy reminder'}
            </button>
          </div>
        )}
        <AddPaymentDialog orderId={o.id} balance={o.balance} />
      </div>

      <div className={card}>
        <h2 className="font-semibold">Files</h2>
        <AttachmentGrid orderId={o.id} />
      </div>
    </div>
  )
}
