import { supabase } from '@/lib/supabase'
import type { SellerType } from '@/types/chat'

const BUCKET = 'seller-verification-docs'

/** Uploads to the private bucket and returns the storage path (not a public URL — see getVerificationDocUrl). */
export async function uploadVerificationDocument(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw error
  return path
}

/** Short-lived signed URL — this bucket is private, unlike product-images/dispute-evidence. */
export async function getVerificationDocUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10)
  return data?.signedUrl ?? null
}

export async function submitSellerRegistration(params: {
  userId: string
  sellerType: SellerType
  fullName: string
  phone: string
  nidOrBusinessNumber: string
  businessName: string | null
  address: string
  documentPath: string
}): Promise<string> {
  const { data, error } = await supabase.rpc('submit_seller_registration', {
    p_user_id: params.userId,
    p_seller_type: params.sellerType,
    p_full_name: params.fullName,
    p_phone: params.phone,
    p_nid_or_business_number: params.nidOrBusinessNumber,
    p_business_name: params.businessName,
    p_address: params.address,
    p_document_path: params.documentPath,
  })
  if (error) throw error
  return data as string
}
