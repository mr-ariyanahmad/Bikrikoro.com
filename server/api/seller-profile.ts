import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type Body = {
  shopName?: string
  shopDescription?: string
  shopUsername?: string
  photoUrl?: string | null
  coverUrl?: string | null
}

function bodyOf(req: VercelRequest): Body {
  if (typeof req.body === 'string') return JSON.parse(req.body) as Body
  return (req.body ?? {}) as Body
}

function safeUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const url = value.trim()
  return /^https:\/\//i.test(url) ? url : null
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
    const shopName = input.shopName?.trim() ?? ''
    const shopDescription = input.shopDescription?.trim() ?? ''
    const shopUsername = input.shopUsername?.trim().toLowerCase() ?? ''
    const photoUrl = safeUrl(input.photoUrl)
    const coverUrl = safeUrl(input.coverUrl)

    if (shopName.length < 2 || shopName.length > 80) throw new Error('শপের নাম ২ থেকে ৮০ অক্ষরের মধ্যে দিন।')
    if (shopDescription.length > 600) throw new Error('শপের বিবরণ সর্বোচ্চ ৬০০ অক্ষরের হতে পারবে।')
    if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(shopUsername)) throw new Error('শপ username ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও হাইফেনে দিন।')

    const supabase = getServiceSupabase()
    const { data: registration, error: registrationError } = await supabase
      .from('seller_registrations')
      .select('status')
      .eq('user_id', token.uid)
      .eq('status', 'APPROVED')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (registrationError) throw registrationError
    if (!registration) {
      res.status(403).json({ error: 'অনুমোদিত সেলার অ্যাকাউন্ট ছাড়া শপ প্রোফাইল সম্পাদনা করা যাবে না।' })
      return
    }

    const { data: availability, error: availabilityError } = await supabase.rpc('check_shop_username', { p_username: shopUsername, p_user_id: token.uid })
    if (availabilityError) throw availabilityError
    const availabilityRow = Array.isArray(availability) ? availability[0] : availability
    if (!availabilityRow?.is_available) {
      res.status(409).json({ error: 'এই username ইতিমধ্যে নেওয়া হয়েছে। অন্য username বেছে নিন।' })
      return
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ shop_name: shopName, shop_description: shopDescription, shop_username: shopUsername, photo_url: photoUrl, shop_cover_url: coverUrl })
      .eq('id', token.uid)
      .select('id, name, photo_url, shop_name, shop_description, shop_username, shop_cover_url, is_verified, rating, review_count, created_at')
      .single()
    if (error) throw error

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ profile })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'আবার লগইন করে চেষ্টা করুন।' })
      return
    }
    console.error('Seller profile update failed:', error)
    res.status(400).json({ error: error instanceof Error ? error.message : 'শপ প্রোফাইল সংরক্ষণ করা যায়নি।' })
  }
}
