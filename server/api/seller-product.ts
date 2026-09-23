import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'
import { notifySimilarProductInterest } from '../lib/similarProductAlerts.js'

type Action = 'create' | 'update'
type Body = {
  action?: Action
  productId?: string
  title?: string
  description?: string
  price?: number
  originalPrice?: number | null
  categoryId?: string
  condition?: 'NEW' | 'USED'
  images?: string[]
  videoUrl?: string | null
}

function bodyOf(req: VercelRequest): Body {
  if (typeof req.body === 'string') return JSON.parse(req.body) as Body
  return (req.body ?? {}) as Body
}

function cleanImages(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = await getVerifiedFirebaseToken(req)
    const input = bodyOf(req)
    const action = input.action
    const title = input.title?.trim() ?? ''
    const description = input.description?.trim() ?? ''
    const categoryId = input.categoryId?.trim() ?? ''
    const images = cleanImages(input.images)
    const price = Number(input.price)
    const originalPrice = input.originalPrice == null || input.originalPrice === 0 ? null : Number(input.originalPrice)
    const videoUrl = input.videoUrl?.trim() || null

    if (action !== 'create' && action !== 'update') throw new Error('Unsupported seller product action')
    if (!title || !categoryId || !Number.isFinite(price) || price <= 0 || !['NEW', 'USED'].includes(input.condition ?? '') || images.length === 0) {
      throw new Error('Title, category, valid price, condition and at least one image are required')
    }
    if (originalPrice !== null && (!Number.isFinite(originalPrice) || originalPrice <= 0)) throw new Error('Original price is invalid')

    const supabase = getServiceSupabase()
    if (action === 'create') {
      const { data: paymentAccount, error: paymentAccountError } = await supabase
        .from('payment_accounts')
        .select('id')
        .eq('user_id', token.uid)
        .eq('purpose', 'SELLER_RECEIVE')
        .eq('is_default', true)
        .maybeSingle()
      if (paymentAccountError) throw paymentAccountError
      if (!paymentAccount) {
        res.status(428).json({ code: 'SELLER_PAYMENT_ACCOUNT_REQUIRED', error: 'লিস্টিং প্রকাশের আগে একটি default seller payment account যোগ করুন।' })
        return
      }
    }
    const rpcArgs = {
      p_seller_id: token.uid,
      p_title: title,
      p_description: description,
      p_price: price,
      p_original_price: originalPrice,
      p_category_id: categoryId,
      p_condition: input.condition,
      p_location: '',
      p_images: images,
      p_is_digital: true,
      p_supports_cod: false,
      p_free_delivery: false,
      p_fast_delivery: false,
      p_free_return: false,
      p_video_url: videoUrl,
    }

    if (action === 'create') {
      const { data, error } = await supabase.rpc('seller_create_product', rpcArgs)
      if (error) throw error
      void notifySimilarProductInterest(supabase, String(data)).catch((alertError) => console.error('Similar product alert delivery failed:', alertError))
      res.status(200).json({ productId: data })
      return
    }

    const productId = input.productId?.trim()
    if (!productId) throw new Error('Product ID is required')
    const { data, error } = await supabase.rpc('seller_update_product', { ...rpcArgs, p_product_id: productId })
    if (error) throw error
    res.status(200).json({ productId: data ?? productId })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    const message = error instanceof Error ? error.message : 'Seller product could not be saved'
    if (message.includes('SELLER_PAYMENT_ACCOUNT_REQUIRED')) {
      res.status(428).json({ code: 'SELLER_PAYMENT_ACCOUNT_REQUIRED', error: 'লিস্টিং প্রকাশের আগে একটি default seller payment account যোগ করুন।' })
      return
    }
    if (message.includes('DUPLICATE_PENDING_PRODUCT')) {
      res.status(409).json({ code: 'DUPLICATE_PENDING_PRODUCT', error: 'এই শিরোনাম ও বিবরণসহ একটি প্রোডাক্ট ইতিমধ্যে যাচাইয়ের জন্য জমা হয়েছে। যাচাই শেষ হলে সেটি ওয়েবসাইটে লাইভ দেখাবে।' })
      return
    }
    console.error('Seller product action failed:', error)
    res.status(400).json({ error: message })
  }
}
