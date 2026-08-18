type OrderEmailRole = 'CUSTOMER' | 'SELLER'

export type NewOrderEmailInput = {
  orderId: string
  role: OrderEmailRole
  to: string
  productTitle: string
  price: number | string
  status: string
  customerName: string
  sellerName: string
  orderLink: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function amountLabel(value: number | string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? `৳${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '৳—'
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim())
}

export async function sendNewOrderEmail(input: NewOrderEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL?.trim()
  if (!apiKey || !from) return { skipped: true, reason: 'RESEND_NOT_CONFIGURED' as const }

  const productTitle = escapeHtml(input.productTitle || 'BikriKoro product')
  const recipientName = escapeHtml(input.role === 'CUSTOMER' ? input.customerName : input.sellerName)
  const customerName = escapeHtml(input.customerName || 'Customer')
  const sellerName = escapeHtml(input.sellerName || 'Seller')
  const amount = escapeHtml(amountLabel(input.price))
  const orderId = escapeHtml(input.orderId)
  const orderLink = escapeHtml(input.orderLink)
  const subject = input.role === 'CUSTOMER'
    ? `আপনার নতুন অর্ডার নিশ্চিত হয়েছে — ${input.productTitle || 'BikriKoro'}`
    : `নতুন অর্ডার পেয়েছেন — ${input.productTitle || 'BikriKoro'}`
  const title = input.role === 'CUSTOMER' ? 'আপনার অর্ডার নিশ্চিত হয়েছে' : 'আপনি একটি নতুন অর্ডার পেয়েছেন'
  const intro = input.role === 'CUSTOMER'
    ? `ধন্যবাদ ${recipientName}। আপনার অর্ডারটি BikriKoro-তে রেকর্ড হয়েছে।`
    : `হ্যালো ${recipientName}। আপনার listing-এর জন্য নতুন অর্ডার এসেছে।`
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#f7faf9;padding:24px;color:#17231f"><div style="max-width:620px;margin:auto;background:#fff;border:1px solid #dce8e2;border-radius:18px;padding:28px"><h1 style="color:#087f5b;margin:0 0 12px">${title}</h1><p>${intro}</p><div style="background:#f0faf5;border-radius:12px;padding:16px;margin:20px 0"><p style="margin:0 0 8px"><strong>Product:</strong> ${productTitle}</p><p style="margin:0 0 8px"><strong>Amount:</strong> ${amount}</p><p style="margin:0 0 8px"><strong>Order ID:</strong> ${orderId}</p><p style="margin:0"><strong>Status:</strong> ${escapeHtml(input.status)}</p></div><p><strong>Customer:</strong> ${customerName}<br><strong>Seller:</strong> ${sellerName}</p><p style="margin-top:24px"><a href="${orderLink}" style="display:inline-block;background:#087f5b;color:#fff;text-decoration:none;border-radius:10px;padding:12px 18px">অর্ডার দেখুন</a></p><p style="color:#66756e;font-size:12px;margin-top:28px">এই emailটি BikriKoro.Com থেকে স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে।</p></div></body></html>`
  const text = `${title}\n\n${intro}\n\nProduct: ${input.productTitle}\nAmount: ${amountLabel(input.price)}\nOrder ID: ${input.orderId}\nStatus: ${input.status}\nCustomer: ${input.customerName}\nSeller: ${input.sellerName}\n\nOrder: ${input.orderLink}`

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `bikrikoro-order-${input.orderId}-${input.role.toLowerCase()}`,
    },
    body: JSON.stringify({ from, to: [input.to], subject, html, text }),
  })
  const payload = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string }
  if (!response.ok) throw new Error(payload.message || payload.name || `Resend request failed (${response.status})`)
  return { skipped: false, id: payload.id ?? null }
}
