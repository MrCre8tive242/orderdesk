import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Payment } from '../lib/types'

export function usePayments(orderId: string) {
  return useQuery({
    queryKey: ['payments', orderId],
    queryFn: async () => {
      const { data, error } = await supabase.from('payments').select('*').eq('order_id', orderId).order('paid_at')
      if (error) throw error
      return data as Payment[]
    },
  })
}
