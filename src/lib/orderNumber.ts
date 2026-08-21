export function formatOrderNumber(orderNumber: number | null | undefined, fallbackId?: string) {
  if (typeof orderNumber === 'number' && Number.isFinite(orderNumber)) return `BKCOM${Math.trunc(orderNumber)}`
  if (fallbackId) return `BKCOM${fallbackId.replaceAll('-', '').slice(0, 6).toUpperCase()}`
  return 'BKCOM—'
}
