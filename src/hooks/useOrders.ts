import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { OrderStatus, OrderSummary, PaymentState } from '../lib/types'

export interface OrderFilters {
  status?: OrderStatus[]
  paymentState?: PaymentState
  dueFrom?: string
  dueTo?: string
  search?: string
}

export function useOrders(filters: OrderFilters = {}) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      let q = supabase.from('order_summary').select('*').order('due_date', { ascending: true, nullsFirst: false })
      if (filters.status?.length) q = q.in('status', filters.status)
      if (filters.paymentState) q = q.eq('payment_state', filters.paymentState)
      if (filters.dueFrom) q = q.gte('due_date', filters.dueFrom)
      if (filters.dueTo) q = q.lte('due_date', filters.dueTo)
      const s = filters.search?.trim().replace(/[,()%"\\*]/g, ' ') // chars that break PostgREST or() syntax
      if (s) {
        const n = parseInt(s.replace('#', ''), 10)
        const parts = [`title.ilike.%${s}%`, `customer_name.ilike.%${s}%`, `customer_phone.ilike.%${s}%`]
        if (!isNaN(n)) parts.push(`order_no.eq.${n}`)
        q = q.or(parts.join(','))
      }
      const { data, error } = await q
      if (error) throw error
      return data as OrderSummary[]
    },
  })
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['order', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('order_summary').select('*').eq('id', id!).single()
      if (error) throw error
      return data as OrderSummary
    },
  })
}
