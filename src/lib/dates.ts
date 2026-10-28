const pad = (n: number) => String(n).padStart(2, '0')
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => toISO(new Date())

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Next given weekday after today (0 = Sun … 5 = Fri); never today. */
export function nextWeekday(day: number) {
  const d = new Date()
  d.setDate(d.getDate() + (((day - d.getDay() + 7) % 7) || 7))
  return toISO(d)
}

/** Next 7 days starting today (inclusive). */
export const weekRange = () => ({ from: today(), to: addDays(today(), 7) })

export const formatDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : '—'

export const isOverdue = (due: string | null, status: string) =>
  !!due && due < today() && status !== 'delivered' && status !== 'cancelled'

export const dueSoon = (due: string | null) => {
  if (!due) return false
  const { from, to } = weekRange()
  return due >= from && due <= to
}
