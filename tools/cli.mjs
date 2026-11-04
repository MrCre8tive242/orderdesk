#!/usr/bin/env node
// OrderDesk command line. Usage: npm run order -- help
import { parseArgs } from 'node:util'
import readline from 'node:readline/promises'
import * as od from './core.mjs'

const HELP = `OrderDesk command line   (run as: npm run order -- <command> ...)

  new "<message text>" [--deposit 100] [--method cash] [--yes]
        Paste a WhatsApp message / describe the order in plain words. Claude reads it, shows the
        draft, and asks before saving. --yes skips the question (needed when not in a terminal).
  add --customer "Maria" --title "12 church shirts" [--phone 242-555-0100] [--qty 12] [--price 240]
      [--due 2026-11-20] [--product shirt] [--details "..."] [--deposit 100] [--method cash]
  list [--search maria] [--status printing] [--all] [--unpaid] [--limit 25]
  show <order# | customer name>
  status <order# | name> <${od.STATUSES.join('|')}>
  pay <order# | name> [amount] [--method ${od.PAYMENT_METHODS.join('|')}] [--date YYYY-MM-DD] [--ref "..."]
        (no amount = pay the full remaining balance)
  update <order# | name> [--title] [--price] [--qty] [--due YYYY-MM-DD | --due none] [--details] [--add-details "..."]

Add --json to any command for machine-readable output.`

const line = (o) =>
  `#${o.order_no}  ${(o.customer ?? '?').padEnd(18).slice(0, 18)}  ${o.title.padEnd(30).slice(0, 30)}  ${o.status.replace(/_/g, ' ').padEnd(16)}  ` +
  `due ${o.due_date ?? '-'.padEnd(10)}  $${o.price.toFixed(2)} (${o.payment_state}, owes $${o.balance.toFixed(2)})`

function print(order) {
  console.log(`#${order.order_no}  ${order.title}`)
  console.log(`  customer : ${order.customer ?? '-'}  ${order.phone ?? ''}`)
  console.log(`  status   : ${order.status.replace(/_/g, ' ')}     due: ${order.due_date ?? '-'}`)
  console.log(`  qty ${order.quantity ?? '-'}  ${order.product_type ?? ''}  price $${order.price.toFixed(2)}  paid $${order.paid.toFixed(2)}  balance $${order.balance.toFixed(2)} (${order.payment_state})`)
  if (order.details) console.log(`  details  : ${order.details.replace(/\n/g, '\n             ')}`)
}

async function confirm(q) {
  if (!process.stdin.isTTY) return false
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const a = (await rl.question(`${q} [Y/n] `)).trim().toLowerCase()
  rl.close()
  return a === '' || a === 'y' || a === 'yes'
}

const num = (v, label) => {
  if (v === undefined) return undefined
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number, got "${v}"`)
  return n
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2)
  const { values: v, positionals: p } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      customer: { type: 'string' }, phone: { type: 'string' }, email: { type: 'string' }, title: { type: 'string' },
      details: { type: 'string' }, 'add-details': { type: 'string' }, product: { type: 'string' }, qty: { type: 'string' },
      price: { type: 'string' }, due: { type: 'string' }, source: { type: 'string' }, deposit: { type: 'string' },
      method: { type: 'string' }, date: { type: 'string' }, ref: { type: 'string' }, search: { type: 'string' },
      status: { type: 'string' }, limit: { type: 'string' }, all: { type: 'boolean' }, unpaid: { type: 'boolean' },
      yes: { type: 'boolean', short: 'y' }, json: { type: 'boolean' },
    },
  })
  const out = (data, human) => (v.json ? console.log(JSON.stringify(data, null, 2)) : human())

  switch (cmd) {
    case 'new': {
      const text = p.join(' ').trim()
      if (!text) throw new Error('Give the message text: npm run order -- new "Hi, it\'s Maria, I need 12 shirts by Friday"')
      const d = await od.parseText(text)
      const fields = {
        customer_name: d.customer_name, phone: d.phone, email: d.email, title: d.title, details: d.details,
        product_type: d.product_type, quantity: d.quantity, price: d.price, due_date: d.due_date, source: d.source ?? 'whatsapp',
        deposit: num(v.deposit, '--deposit'), deposit_method: v.method,
      }
      if (!fields.customer_name) throw new Error(`Could not find a customer name in that message. Use "add --customer ..." instead.\nParsed: ${JSON.stringify(d)}`)
      if (!fields.title) fields.title = `${fields.quantity ?? ''} ${fields.product_type ?? 'item'}s`.trim()
      console.error('Draft order:\n' + JSON.stringify(fields, null, 2))
      if (!v.yes && !(await confirm('Save this order?'))) {
        console.error(process.stdin.isTTY ? 'Not saved.' : 'Not saved (no terminal to confirm). Re-run with --yes to save.')
        return process.exitCode = 1
      }
      const r = await od.createOrder(fields)
      return out(r, () => { print(r.order); r.notes.forEach((n) => console.log('  - ' + n)) })
    }
    case 'add': {
      const r = await od.createOrder({
        customer_name: v.customer, phone: v.phone, email: v.email, title: v.title, details: v.details,
        product_type: v.product, quantity: num(v.qty, '--qty'), price: num(v.price, '--price'), due_date: v.due,
        source: v.source, deposit: num(v.deposit, '--deposit'), deposit_method: v.method,
      })
      return out(r, () => { print(r.order); r.notes.forEach((n) => console.log('  - ' + n)) })
    }
    case 'list': {
      const rows = await od.listOrders({
        search: v.search ?? p.join(' '), status: v.status, open: !v.all, payment_state: v.unpaid ? 'unpaid' : undefined,
        limit: num(v.limit, '--limit') ?? 25,
      })
      return out(rows, () => (rows.length ? rows.forEach((o) => console.log(line(o))) : console.log('No orders found.')))
    }
    case 'show': {
      const r = await od.getOrder(p.join(' '))
      return out(r, () => {
        print(r.order)
        r.payments.forEach((x) => console.log(`  payment  : $${Number(x.amount).toFixed(2)} ${x.method ?? ''} ${x.paid_at ?? ''} ${x.reference ?? ''}`))
      })
    }
    case 'status': {
      const status = p.at(-1)
      const r = await od.setStatus(p.slice(0, -1).join(' '), status)
      return out(r, () => { console.log(`#${r.order.order_no} ${r.before_status} -> ${r.order.status}`) })
    }
    case 'pay': {
      // amount is optional; if the last positional is a number treat it as the amount
      const last = p.at(-1)
      const hasAmt = p.length > 1 && /^\$?\d+(\.\d+)?$/.test(last)
      const r = await od.addPayment(hasAmt ? p.slice(0, -1).join(' ') : p.join(' '), {
        amount: hasAmt ? Number(last.replace('$', '')) : undefined, method: v.method, paid_at: v.date, reference: v.ref,
      })
      return out(r, () => {
        console.log(`Recorded $${r.recorded.amount.toFixed(2)} (${r.recorded.method}) on #${r.order.order_no}. Balance now $${r.order.balance.toFixed(2)} (${r.order.payment_state}).`)
        r.notes.forEach((n) => console.log('  - ' + n))
      })
    }
    case 'update': {
      const patch = {}
      if (v.title !== undefined) patch.title = v.title
      if (v.details !== undefined) patch.details = v.details
      if (v['add-details'] !== undefined) patch.append_details = v['add-details']
      if (v.product !== undefined) patch.product_type = v.product
      if (v.qty !== undefined) patch.quantity = num(v.qty, '--qty')
      if (v.price !== undefined) patch.price = num(v.price, '--price')
      if (v.due !== undefined) patch.due_date = v.due === 'none' ? null : v.due
      if (v.source !== undefined) patch.source = v.source
      const r = await od.updateOrder(p.join(' '), patch)
      return out(r, () => print(r.order))
    }
    case undefined: case 'help': case '--help': case '-h':
      return console.log(HELP)
    default:
      throw new Error(`Unknown command "${cmd}".\n\n${HELP}`)
  }
}

main().catch((e) => {
  console.error('Error: ' + (e?.message ?? e))
  process.exitCode = 1
})
