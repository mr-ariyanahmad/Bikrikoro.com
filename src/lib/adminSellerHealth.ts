export type SellerHealth = { missing_items: string[]; registration_status: string | null; product_count: number; latest_product_at: string | null; seller_email_verified_at: string | null }

export function getSellerHealth(seller: SellerHealth) {
  let score = 100
  const reasons: string[] = []
  if (seller.missing_items.length > 0) { score -= Math.min(35, seller.missing_items.length * 10); reasons.push(`${seller.missing_items.length}টি তথ্য/ডকুমেন্ট বাকি`) }
  if (seller.registration_status === 'PENDING') { score -= 15; reasons.push('verification pending') }
  if (seller.registration_status === 'REJECTED') { score -= 25; reasons.push('verification rejected') }
  if (seller.product_count === 0) { score -= 15; reasons.push('এখনো কোনো product নেই') }
  if (seller.product_count > 0 && !seller.latest_product_at) { score -= 10; reasons.push('সাম্প্রতিক activity নেই') }
  if (!seller.seller_email_verified_at) { score -= 10; reasons.push('email verification বাকি') }
  score = Math.max(0, Math.min(100, score))
  return { score, reasons, tone: score >= 80 ? 'green' as const : score >= 55 ? 'amber' as const : 'red' as const, label: score >= 80 ? 'ভালো' : score >= 55 ? 'মনিটর করুন' : 'ঝুঁকিপূর্ণ' }
}
