#!/usr/bin/env node
// OrderDesk MCP server (stdio). Lets Claude read and update the order desk directly.
// Register it with:  claude mcp add orderdesk -- node /path/to/orderdesk/tools/mcp-server.mjs
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import * as od from './core.mjs'

const server = new McpServer({ name: 'orderdesk', version: '1.0.0' })

const status = z.enum(od.STATUSES)
const method = z.enum(od.PAYMENT_METHODS)
const product = z.enum(od.PRODUCT_TYPES)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
const ref = z.string().describe('Order number like "1042" or "#1042", or words from the customer name / phone / title. Prefer the order number.')

/** Wrap a handler so every failure comes back as a readable tool error instead of crashing the server. */
const tool = (name, description, shape, fn, annotations = {}) =>
  server.registerTool(name, { description, inputSchema: shape, annotations }, async (args) => {
    try {
      return { content: [{ type: 'text', text: JSON.stringify(await fn(args), null, 2) }] }
    } catch (e) {
      return { isError: true, content: [{ type: 'text', text: e?.message ?? String(e) }] }
    }
  })

tool('list_orders',
  'List orders from the order desk (open orders by default, soonest due first). Use to answer "what is due this week", "who owes money", "what is printing".',
  {
    search: z.string().optional().describe('Customer name, phone, title words, or order number'),
    status: status.optional().describe('Only this status'),
    include_closed: z.boolean().optional().describe('Also include delivered and cancelled orders'),
    payment_state: z.enum(['unpaid', 'partial', 'paid']).optional(),
    due_from: date.optional(), due_to: date.optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  (a) => od.listOrders({ ...a, open: !a.include_closed }),
  { readOnlyHint: true })

tool('get_order', 'Show one order with its payment history.', { order: ref }, (a) => od.getOrder(a.order), { readOnlyHint: true })

tool('create_order',
  'Create a new order. Finds the customer by phone (or exact name) or creates them. Optionally records a deposit. ' +
  'Resolve relative dates ("Friday") to YYYY-MM-DD yourself using today\'s date, and never invent values the user did not give. ' +
  'If the customer name or what they want is missing, ask before calling.',
  {
    customer_name: z.string(), phone: z.string().optional(), email: z.string().optional(),
    title: z.string().describe('Short summary, e.g. "12 church logo shirts"'),
    details: z.string().optional().describe('Sizes, colors, print placement, design notes, deadline wording'),
    product_type: product.optional(), quantity: z.number().int().positive().optional(),
    price: z.number().min(0).optional().describe('Total price in dollars'),
    due_date: date.optional(), source: z.enum(['whatsapp', 'facebook', 'email', 'walk_in', 'other']).optional(),
    status: status.optional().describe('Defaults to inquiry'),
    deposit: z.number().positive().optional().describe('Amount already paid now, recorded as a payment'),
    deposit_method: method.optional().describe('Defaults to cash'),
  },
  (a) => od.createOrder(a))

tool('update_order',
  'Change fields on an existing order (not status or payments: use set_status / add_payment). Set due_date to null to clear it.',
  {
    order: ref,
    title: z.string().optional(), details: z.string().optional().describe('Replaces all details'),
    append_details: z.string().optional().describe('Adds a line to the existing details'),
    product_type: product.optional(), quantity: z.number().int().positive().optional(), price: z.number().min(0).optional(),
    due_date: date.nullable().optional(),
  },
  ({ order, ...patch }) => od.updateOrder(order, patch))

tool('set_status',
  'Move an order to a new status (the same as dragging its card on the Board). Marking delivered stamps the delivery time.',
  { order: ref, status },
  (a) => od.setStatus(a.order, a.status))

tool('add_payment',
  'Record a payment against an order. Omit amount to pay the whole remaining balance. Reports the new balance.',
  {
    order: ref, amount: z.number().positive().optional(), method: method.optional().describe('Defaults to cash'),
    paid_at: date.optional().describe('Defaults to today'), reference: z.string().optional(),
  },
  ({ order, ...p }) => od.addPayment(order, p))

tool('parse_order_text',
  'Run the app\'s own message parser on pasted chat text and return draft fields WITHOUT saving anything. Usually unnecessary: you can read the message yourself and call create_order.',
  { text: z.string().max(5000) },
  (a) => od.parseText(a.text),
  { readOnlyHint: true })

await server.connect(new StdioServerTransport())
