import type { Product } from '@/types/product'

export type ProductQuality = {
  score: number
  label: 'উন্নত' | 'মাঝারি' | 'উন্নতি দরকার'
  tone: 'green' | 'amber' | 'red'
  reasons: string[]
}

export function getProductQuality(product: Product): ProductQuality {
  let score = 0
  const reasons: string[] = []
  const titleLength = product.title.trim().length
  const descriptionLength = product.description.trim().length

  if (titleLength >= 12 && titleLength <= 90) score += 20
  else reasons.push(titleLength < 12 ? 'শিরোনাম আরও পরিষ্কার হওয়া দরকার' : 'শিরোনাম বেশি লম্বা')
  if (descriptionLength >= 80) score += 20
  else reasons.push('বিস্তারিত description যোগ করুন')
  if (product.images.length >= 2) score += 20
  else if (product.images.length === 1) { score += 10; reasons.push('আরও product image যোগ করুন') }
  else reasons.push('Product image নেই')
  if (product.price > 0) score += 15
  else reasons.push('সঠিক price দিন')
  if (product.original_price && product.original_price > product.price) score += 10
  else score += 5
  if (product.category_id.trim()) score += 15
  else reasons.push('Category নির্বাচন করুন')

  const label = score >= 80 ? 'উন্নত' : score >= 55 ? 'মাঝারি' : 'উন্নতি দরকার'
  const tone = score >= 80 ? 'green' : score >= 55 ? 'amber' : 'red'
  return { score, label, tone, reasons }
}
