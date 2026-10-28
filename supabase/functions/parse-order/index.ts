// Deno edge function. Deploy: supabase functions deploy parse-order
// Secret: supabase secrets set ANTHROPIC_API_KEY=...
// The gateway's JWT check also accepts the public anon key, so we confirm a real signed-in user below.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const TZ = 'America/Nassau'
const isoInTz = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD
const weekday = (d: Date) => d.toLocaleDateString('en-US', { timeZone: TZ, weekday: 'long' })

/** Next 28 days spelled out so the model looks dates up instead of doing calendar math. */
function calendar() {
  const now = Date.now()
  return Array.from({ length: 28 }, (_, i) => {
    const d = new Date(now + i * 86400000)
    return `${isoInTz(d)} ${weekday(d)}${i === 0 ? ' (today)' : ''}`
  }).join('\n')
}

const system = () => `You extract a custom-shirt print order from a customer's chat message (usually WhatsApp, often from the Bahamas).
The text may be messy: typos, emojis, slang, voice-note transcripts, several messages pasted together, or WhatsApp export lines like "[10/28/26, 3:14 PM] Maria: ...". In export lines the bracketed timestamp is when the message was sent, not a due date; the name after it is the sender. Lines from the shop itself may be included.

Calendar (use it to resolve dates, do not compute them yourself):
${calendar()}

Date rules: "today", "tomorrow", "Friday" or "this Friday" = the next such weekday on or after tomorrow. "next Friday" = the first Friday after today (it is ambiguous, so also write "customer said 'next Friday'" in details). A date with no year = its next occurrence. "End of the month" = last day of the current month. Vague words ("soon", "asap", "for Junkanoo") = null, but copy them into details.

Return ONLY a JSON object, no prose, no code fence, with exactly these keys:
customer_name, phone, email, title, details, product_type, quantity, price, due_date, source.
- Never invent values. A field not stated in the text is null.
- customer_name: the customer's own name ("my name is Maria", sign-off, or export sender). Not a church, school or business name; put those in details.
- phone: Bahamian numbers appear as 242-555-0100, (242) 555-0100, 2425550100, +1 242 555 0100, 1-242-555-0100, or 7 digits like 555-0100 (assume area code 242). Return as 242-555-0100 style. Other countries: return as written.
- title: short summary like "12 church logo shirts".
- details: sizes and counts per size, colors, print placement, design instructions, deadline wording, anything else useful. Plain text.
- product_type: one of shirt, long sleeve, tote, mug, other. T-shirt/tee/jersey = shirt. null if unclear.
- quantity: integer total. If sizes are listed ("4 S, 6 M, 2 L") use their sum.
- price: total in dollars as a number, no symbol. A stated budget counts. "$20 each" for 12 = 240 (note the unit price in details). B$, BSD and US$ are all dollars.
- due_date: YYYY-MM-DD or null.
- source: "whatsapp".`

const KEYS = ['customer_name', 'phone', 'email', 'title', 'details', 'product_type', 'quantity', 'price', 'due_date', 'source']
const PRODUCTS = ['shirt', 'long sleeve', 'tote', 'mug', 'other']

function clean(d: Record<string, unknown>) {
  const out: Record<string, unknown> = Object.fromEntries(KEYS.map((k) => [k, d[k] ?? null]))
  for (const k of ['customer_name', 'phone', 'email', 'title', 'details']) {
    if (out[k] !== null) out[k] = String(out[k]).trim() || null
  }
  const q = Number(out.quantity)
  out.quantity = Number.isInteger(q) && q > 0 ? q : null
  const p = Number(out.price)
  out.price = out.price !== null && Number.isFinite(p) && p >= 0 ? Math.round(p * 100) / 100 : null
  if (typeof out.due_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(out.due_date)) out.due_date = null
  if (!PRODUCTS.includes(out.product_type as string)) out.product_type = null
  out.source = 'whatsapp'
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const user = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: req.headers.get('Authorization') ?? '', apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
  })
  if (!user.ok) return json({ error: 'Sign in required' }, 401)

  let text: unknown
  try {
    ;({ text } = await req.json())
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  if (typeof text !== 'string' || !text.trim()) return json({ error: 'Text is empty' }, 400)
  if (text.length > 5000) return json({ error: 'Text is over 5000 characters' }, 400)

  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) return json({ error: 'ANTHROPIC_API_KEY not set' }, 500)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-5-5',
      max_tokens: 1024,
      system: system(),
      messages: [{ role: 'user', content: `<message>\n${text}\n</message>` }],
    }),
  })
  if (!res.ok) {
    // pass Anthropic's reason through (bad key, no credit, wrong model) so the app can show it
    const detail = await res.json().then((b) => b?.error?.message).catch(() => null)
    return json({ error: `Model error ${res.status}${detail ? `: ${detail}` : ''}` }, 502)
  }

  const out = await res.json()
  const raw: string = out.content?.[0]?.text ?? ''
  const m = raw.match(/\{[\s\S]*\}/)
  if (!m) return json({ error: 'Could not read the message' }, 502)
  try {
    return json(clean(JSON.parse(m[0])))
  } catch {
    return json({ error: 'Could not read the message' }, 502)
  }
})
