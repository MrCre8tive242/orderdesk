export const STATUSES = [
  'inquiry', 'quoted', 'awaiting_deposit', 'in_design', 'approved',
  'printing', 'ready', 'delivered', 'cancelled',
] as const
export type OrderStatus = (typeof STATUSES)[number]

export const PAYMENT_METHODS = ['cash', 'charge_anywhere', 'wire', 'check', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export type PaymentState = 'unpaid' | 'partial' | 'paid'

export const PRODUCT_TYPES = ['shirt', 'long sleeve', 'tote', 'mug', 'other']
export const SOURCES = ['whatsapp', 'facebook', 'email', 'walk_in', 'other']

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
}

export interface Order {
  id: string
  order_no: number
  customer_id: string | null
  title: string
  details: string | null
  product_type: string | null
  quantity: number | null
  price: number
  due_date: string | null
  status: OrderStatus
  source: string | null
  delivered_at: string | null
}

export interface OrderSummary extends Order {
  customer_name: string | null
  customer_phone: string | null
  paid: number
  balance: number
  payment_state: PaymentState
}

export interface Payment {
  id: string
  order_id: string
  amount: number
  method: PaymentMethod | null
  paid_at: string | null
  reference: string | null
}

export interface OrderFile {
  id: string
  order_id: string
  path: string
  name: string
}

export interface OrderDraft {
  customer_name: string | null
  phone: string | null
  email: string | null
  title: string | null
  details: string | null
  product_type: string | null
  quantity: number | null
  price: number | null
  due_date: string | null
  source: string | null
}

export const OPEN_STATUSES: OrderStatus[] = STATUSES.filter((s) => s !== 'delivered' && s !== 'cancelled')
export const statusLabel = (s: string) => s.replace(/_/g, ' ')
