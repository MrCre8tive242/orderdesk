import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Customer } from '../lib/types'

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').order('name')
      if (error) throw error
      return data as Customer[]
    },
  })
}

/** Bahamas/NANP numbers -> 242-555-0100 so "(242) 555-0100" and "+1 242 5550100" match the same customer. */
export function normalizePhone(raw: string | null | undefined) {
  const t = raw?.trim()
  if (!t) return null
  let d = t.replace(/\D/g, '')
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1)
  if (d.length === 7) d = '242' + d
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : t
}

/** Match an existing customer by phone first; otherwise create one. */
export async function findOrCreateCustomer(c: { name: string; phone?: string | null; email?: string | null }) {
  const phone = normalizePhone(c.phone)
  if (phone) {
    const { data } = await supabase.from('customers').select('id').eq('phone', phone).limit(1)
    if (data?.length) return data[0].id as string
  }
  const { data, error } = await supabase
    .from('customers')
    .insert({ name: c.name.trim(), phone, email: c.email?.trim() || null })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
