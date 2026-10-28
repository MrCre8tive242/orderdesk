import { FormEvent, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { today } from '../lib/dates'
import { PAYMENT_METHODS, type PaymentMethod } from '../lib/types'

const field = 'w-full min-h-[44px] border rounded-lg px-3 bg-white'

export default function AddPaymentDialog({ orderId, balance }: { orderId: string; balance: number }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [date, setDate] = useState(today())
  const [ref, setRef] = useState('')
  const [err, setErr] = useState('')

  function show() {
    setAmount(balance > 0 ? balance.toFixed(2) : '')
    setOpen(true)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('payments').insert({
      order_id: orderId, amount: parseFloat(amount), method, paid_at: date, reference: ref || null,
    })
    if (error) return setErr(error.message)
    await qc.invalidateQueries()
    setOpen(false)
    setRef('')
  }

  if (!open)
    return <button onClick={show} className="min-h-[44px] px-4 rounded-lg bg-indigo-600 text-white font-medium">+ Add payment</button>

  return (
    <form onSubmit={submit} className="border rounded-lg p-3 grid grid-cols-2 gap-2">
      <input required type="number" step="0.01" min="0.01" inputMode="decimal" className={field} value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select className={field} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
      </select>
      <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
      <input className={field} placeholder="Reference (optional)" value={ref} onChange={(e) => setRef(e.target.value)} />
      {err && <p className="col-span-2 text-red-600 text-sm">{err}</p>}
      <button className="min-h-[44px] rounded-lg bg-indigo-600 text-white font-medium">Save</button>
      <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] rounded-lg bg-slate-100">Cancel</button>
    </form>
  )
}
