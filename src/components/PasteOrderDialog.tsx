import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { OrderDraft } from '../lib/types'

const btn = 'min-h-[44px] px-4 rounded-lg font-medium disabled:opacity-50'

export default function PasteOrderDialog({ onDraft }: { onDraft: (d: OrderDraft) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function parse(t: string) {
    setErr('')
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('parse-order', { body: { text: t } })
    setBusy(false)
    if (error || data?.error) return setErr(data?.error ?? error?.message ?? 'Parse failed')
    onDraft(data as OrderDraft)
  }

  // one tap: read the copied WhatsApp message and parse it straight away
  async function pasteAndFill() {
    try {
      const t = (await navigator.clipboard.readText()).slice(0, 5000)
      if (!t.trim()) return setErr('Clipboard is empty. Copy the message in WhatsApp first.')
      setText(t)
      parse(t)
    } catch {
      setErr('Could not read the clipboard. Long-press the box below and tap Paste.')
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 space-y-2">
      <h2 className="font-semibold">Paste a WhatsApp message</h2>
      <button onClick={pasteAndFill} disabled={busy} className={`${btn} w-full bg-indigo-600 text-white`}>
        {busy ? 'Reading…' : 'Paste & fill from clipboard'}
      </button>
      <textarea
        className="w-full border rounded-lg p-3" rows={4} maxLength={5000} value={text}
        onChange={(e) => setText(e.target.value)} placeholder="…or paste / type the message here"
      />
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <button onClick={() => parse(text)} disabled={busy || !text.trim()} className={`${btn} bg-slate-100`}>
        Fill from message
      </button>
    </div>
  )
}
