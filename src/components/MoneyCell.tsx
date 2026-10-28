import { formatMoney } from '../lib/money'

export default function MoneyCell({ value, danger }: { value: number; danger?: boolean }) {
  return <span className={danger && value > 0 ? 'text-red-600 font-medium' : ''}>{formatMoney(value)}</span>
}
