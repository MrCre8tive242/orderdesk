// Number(): numeric may arrive as a string; round first so float sums like 0.1+0.2 never show -$0.00
export const formatMoney = (n: number | string | null | undefined) => {
  const v = Math.round(Number(n ?? 0) * 100) / 100 || 0
  return (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const balanceOf = (price: number, paid: number) => price - paid
