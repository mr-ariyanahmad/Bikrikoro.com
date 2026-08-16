/** Same lakh/crore grouping as Android's formatPriceBDT() — ৳1,25,000 not ৳125,000. */
export function formatTaka(amount: number): string {
  const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
  return `৳${formatter.format(amount)}`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('bn-BD', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
