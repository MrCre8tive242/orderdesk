// Shared logic for the OrderDesk command line (tools/cli.mjs) and MCP server (tools/mcp-server.mjs).
// Talks to the same Supabase project as the app, signed in as you, so the database's row-level
// security still applies. Plain ESM, no build step.
import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// loadEnvFile never overrides variables that are already set, so real env vars win over files.
for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(path.join(root, f)) } catch { /* file missing: fine */ }
}

export const STATUSES = ['inquiry', 'quoted', 'awaiting_deposit', 'in_design', 'approved', 'printing', 'ready', 'delivered', 'cancelled']
export const PAYMENT_METHODS = ['cash', 'charge_anywhere', 'wire', 'check', 'other']
export const PRODUCT_TYPES = ['shirt', 'long sleeve', 'tote', 'mug', 'other']
export const OPEN_STATUSES = STATUSES.filter((s) => s !== 'delivered' && s !== 'cancelled')

const TZ = 'America/Nassau'
export const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s))

// ---------- connection ----------
let clientPromise
export function getClient() {
  clientPromise ??= (async () => {
    const need = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'ORDERDESK_EMAIL', 'ORDERDESK_PASSWORD']
    const missing = need.filter((k) => !process.env[k])
    if (missing.length) throw new Error(`Missing ${missing.join(', ')}. Set them in ${path.join(root, '.env')} (see .env.example).`)
    const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: true },
    })
    const { error } = await sb.auth.signInWithPassword({ email: process.env.ORDERDESK_EMAIL, password: process.env.ORDERDESK_PASSWORD })
    if (error) throw new Error(`Sign-in failed: ${error.message}`)
    return sb
  })()
  clientPromise.catch(() => { clientPromise = undefined }) // let the next call retry
  return clientPromise
}

// ---------- helpers ----------
/** Bahamas/NANP numbers -> 242-555-0100 (same rule as the app). */
export function normalizePhone(raw) {
  const t = raw?.trim()
  if (!t) return null
  let d = t.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  if (d.length === 7) d = '242' + d
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : t
}

const money = (n) => Math.round(Number(n) * 100) / 100
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}
const checkStatus = (s) => {
  if (!STATUSES.includes(s)) throw new Error(`Unknown status "${s}". Use one of: ${STATUSES.join(', ')}`)
}
const checkMethod = (m) => {
  if (!PAYMENT_METHODS.includes(m)) throw new Error(`Unknown payment method "${m}". Use one of: ${PAYMENT_METHODS.join(', ')}`)
}
const checkDate = (d, label) => {
  if (!isDate(d)) throw new Error(`${label} must be YYYY-MM-DD, got "${d}"`)
}

/** Compact, human-readable view of an order_summary row. */
export function brief(o) {
  return {
    order_no: o.order_no,
    customer: o.customer_name,
    phone: o.customer_phone,
    title: o.title,
    status: o.status,
    quantity: o.quantity,
    price: Number(o.price),
    paid: Number(o.paid),
    balance: Number(o.balance),
    payment_state: o.payment_state,
    due_date: o.due_date,
    product_type: o.product_type,
    details: o.details,
    source: o.source,
  }
}

// ---------- customers ----------
/**
 * Match by phone, else by exact (case-insensitive) name, else create.
 * Returns { id, created, matchedBy } so callers can say what happened.
 */
export async function findOrCreateCustomer({ name, phone, email }) {
  const sb = await getClient()
  const nm = name?.trim()
  if (!nm) throw new Error('Customer name is required')
  const ph = normalizePhone(phone)
  if (ph) {
    const rows = must(await sb.from('customers').select('id,name').eq('phone', ph).limit(1), 'Customer lookup')
    if (rows.length) return { id: rows[0].id, name: rows[0].name, created: false, matchedBy: 'phone' }
  } else {
    const esc = nm.replace(/[\\%_]/g, '\\$&')
    const rows = must(await sb.from('customers').select('id,name').ilike('name', esc).limit(2), 'Customer lookup')
    if (rows.length === 1) return { id: rows[0].id, name: rows[0].name, created: false, matchedBy: 'name' }
    // 2+ people with the same name and no phone to tell them apart: make a new one rather than guess
  }
  const row = must(
    await sb.from('customers').insert({ name: nm, phone: ph, email: email?.trim() || null }).select('id,name').single(),
    'Create customer',
  )
  return { id: row.id, name: row.name, created: true, matchedBy: null }
}

// ---------- orders ----------
async function summaryById(id) {
  const sb = await getClient()
  return must(await sb.from('order_summary').select('*').eq('id', id).single(), 'Load order')
}

/**
 * Find ONE order from "1042", "#1042", or words (customer name / title / phone).
 * Words only search open orders unless includeClosed. Throws with candidates if not exactly one match.
 */
export async function resolveOrder(ref, { includeClosed = false } = {}) {
  const sb = await getClient()
  const text = String(ref ?? '').trim()
  if (!text) throw new Error('Which order? Give an order number or a customer name.')
  const num = /^#?\s*(\d{3,})$/.exec(text)
  if (num) {
    const rows = must(await sb.from('order_summary').select('*').eq('order_no', Number(num[1])), 'Find order')
    if (!rows.length) throw new Error(`No order #${num[1]}`)
    return rows[0]
  }
  const s = text.replace(/[,()%"\\*]/g, ' ').trim()
  let q = sb.from('order_summary').select('*').or(`title.ilike.%${s}%,customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%`)
  if (!includeClosed) q = q.in('status', OPEN_STATUSES)
  const rows = must(await q.order('created_at', { ascending: false }).limit(10), 'Find order')
  if (rows.length === 1) return rows[0]
  if (!rows.length) throw new Error(`No ${includeClosed ? '' : 'open '}order matches "${text}"`)
  const list = rows.map((o) => `#${o.order_no} ${o.customer_name ?? '?'} - ${o.title} [${o.status}]`).join('; ')
  throw new Error(`"${text}" matches ${rows.length} orders, say which one: ${list}`)
}

/**
 * Create customer (if needed) + order (+ optional deposit payment).
 * fields: customer_name, phone?, email?, title, details?, product_type?, quantity?, price?, due_date?,
 *         source?, status?, deposit?, deposit_method?
 */
export async function createOrder(f) {
  const sb = await getClient()
  if (!f.title?.trim()) throw new Error('title is required (e.g. "12 church logo shirts")')
  if (f.due_date) checkDate(f.due_date, 'due_date')
  if (f.product_type && !PRODUCT_TYPES.includes(f.product_type)) throw new Error(`product_type must be one of: ${PRODUCT_TYPES.join(', ')}`)
  const status = f.status ?? 'inquiry'
  checkStatus(status)
  const price = f.price == null ? 0 : money(f.price)
  if (!(price >= 0)) throw new Error('price must be 0 or more')
  const deposit = f.deposit == null ? 0 : money(f.deposit)
  if (deposit < 0) throw new Error('deposit must be positive')
  if (f.deposit_method) checkMethod(f.deposit_method)

  const cust = await findOrCreateCustomer({ name: f.customer_name, phone: f.phone, email: f.email })
  const order = must(
    await sb.from('orders').insert({
      customer_id: cust.id,
      title: f.title.trim(),
      details: f.details?.trim() || null,
      product_type: f.product_type ?? null,
      quantity: f.quantity && f.quantity > 0 ? Math.trunc(f.quantity) : 1,
      price,
      due_date: f.due_date ?? null,
      status,
      source: f.source ?? null,
      delivered_at: status === 'delivered' ? new Date().toISOString() : null,
    }).select('id').single(),
    'Create order',
  )
  if (deposit > 0) {
    must(await sb.from('payments').insert({
      order_id: order.id, amount: deposit, method: f.deposit_method ?? 'cash', paid_at: todayISO(), reference: 'deposit',
    }), 'Record deposit')
  }
  const o = brief(await summaryById(order.id))
  const notes = []
  notes.push(cust.created ? `New customer "${cust.name}" created.` : `Matched existing customer "${cust.name}" by ${cust.matchedBy}.`)
  if (price === 0) notes.push('Price is 0: not set yet.')
  if (deposit > Number(o.price) && o.price > 0) notes.push('Deposit is more than the price.')
  return { order: o, notes }
}

/** Change fields on an existing order. patch keys: title, details, product_type, quantity, price, due_date (null clears), status, source, append_details */
export async function updateOrder(ref, patch) {
  const sb = await getClient()
  const cur = await resolveOrder(ref, { includeClosed: true })
  const set = {}
  if (patch.title !== undefined) set.title = patch.title.trim()
  if (patch.product_type !== undefined) {
    if (patch.product_type && !PRODUCT_TYPES.includes(patch.product_type)) throw new Error(`product_type must be one of: ${PRODUCT_TYPES.join(', ')}`)
    set.product_type = patch.product_type
  }
  if (patch.quantity !== undefined) set.quantity = Math.trunc(patch.quantity)
  if (patch.price !== undefined) set.price = money(patch.price)
  if (patch.source !== undefined) set.source = patch.source
  if (patch.due_date !== undefined) {
    if (patch.due_date !== null) checkDate(patch.due_date, 'due_date')
    set.due_date = patch.due_date
  }
  if (patch.details !== undefined) set.details = patch.details
  if (patch.append_details) set.details = [set.details ?? cur.details, patch.append_details].filter(Boolean).join('\n')
  if (patch.status !== undefined) {
    checkStatus(patch.status)
    set.status = patch.status
    if (patch.status !== cur.status) set.delivered_at = patch.status === 'delivered' ? new Date().toISOString() : null
  }
  if (!Object.keys(set).length) throw new Error('Nothing to change')
  must(await sb.from('orders').update(set).eq('id', cur.id), 'Update order')
  return { before_status: cur.status, order: brief(await summaryById(cur.id)) }
}

export const setStatus = (ref, status) => updateOrder(ref, { status })

/** Record a payment. amount omitted => pays the whole remaining balance. */
export async function addPayment(ref, { amount, method = 'cash', paid_at, reference } = {}) {
  const sb = await getClient()
  checkMethod(method)
  if (paid_at) checkDate(paid_at, 'paid_at')
  const cur = await resolveOrder(ref, { includeClosed: true })
  const amt = amount == null ? Number(cur.balance) : money(amount)
  if (!(amt > 0)) throw new Error(amount == null ? `Order #${cur.order_no} has no balance to pay` : 'amount must be more than 0')
  must(await sb.from('payments').insert({
    order_id: cur.id, amount: amt, method, paid_at: paid_at ?? todayISO(), reference: reference?.trim() || null,
  }), 'Record payment')
  const o = brief(await summaryById(cur.id))
  const notes = []
  if (o.balance < 0) notes.push(`Overpaid by ${(-o.balance).toFixed(2)}.`)
  if (o.balance === 0 && o.status !== 'delivered') notes.push('Fully paid.')
  return { recorded: { amount: amt, method }, order: o, notes }
}

export async function listOrders({ search, status, open = true, payment_state, due_from, due_to, limit = 25 } = {}) {
  const sb = await getClient()
  let q = sb.from('order_summary').select('*').order('due_date', { ascending: true, nullsFirst: false }).limit(Math.min(limit, 100))
  if (status) { checkStatus(status); q = q.eq('status', status) } else if (open) q = q.in('status', OPEN_STATUSES)
  if (payment_state) q = q.eq('payment_state', payment_state)
  if (due_from) q = q.gte('due_date', due_from)
  if (due_to) q = q.lte('due_date', due_to)
  const s = search?.trim().replace(/[,()%"\\*]/g, ' ').trim()
  if (s) {
    const parts = [`title.ilike.%${s}%`, `customer_name.ilike.%${s}%`, `customer_phone.ilike.%${s}%`]
    const n = parseInt(s.replace('#', ''), 10)
    if (!isNaN(n)) parts.push(`order_no.eq.${n}`)
    q = q.or(parts.join(','))
  }
  return must(await q, 'List orders').map(brief)
}

export async function getOrder(ref) {
  const sb = await getClient()
  const cur = await resolveOrder(ref, { includeClosed: true })
  const payments = must(await sb.from('payments').select('amount,method,paid_at,reference').eq('order_id', cur.id).order('paid_at'), 'Load payments')
  return { order: brief(cur), payments }
}

/** Free text (WhatsApp message etc.) -> draft fields, using the app's deployed parse-order function. */
export async function parseText(text) {
  const sb = await getClient()
  const { data, error } = await sb.functions.invoke('parse-order', { body: { text } })
  if (error) {
    let msg = error.message
    try { const b = await error.context.json(); if (b?.error) msg = b.error } catch { /* keep generic */ }
    throw new Error(`parse-order: ${msg}`)
  }
  if (data?.error) throw new Error(`parse-order: ${data.error}`)
  return data
}
