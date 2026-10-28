import { statusLabel } from '../lib/types'

export const STATUS_COLORS: Record<string, string> = {
  inquiry: '#64748b', quoted: '#0ea5e9', awaiting_deposit: '#f59e0b', in_design: '#8b5cf6',
  approved: '#14b8a6', printing: '#4f46e5', ready: '#16a34a', delivered: '#475569', cancelled: '#dc2626',
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white capitalize whitespace-nowrap"
      style={{ background: STATUS_COLORS[status] ?? '#64748b' }}
    >
      {statusLabel(status)}
    </span>
  )
}
