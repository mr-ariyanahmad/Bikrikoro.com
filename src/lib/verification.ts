import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/firebase'
import type { BusinessType, ListingMode, SellerType } from '@/types/chat'

const BUCKET = 'seller-verification-docs'

/** Uploads to the private bucket and returns the storage path (not a public URL — see getVerificationDocUrl). */
export async function uploadVerificationDocument(file: File, userId: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw error
  return path
}

/** Short-lived signed URL issued only by the server after Firebase owner/admin authorization. */
export async function getVerificationDocUrl(path: string): Promise<string | null> {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) return null
  const response = await fetch(`/api/verification-document?path=${encodeURIComponent(path)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  if (!response.ok) return null
  const result = await response.json() as { signedUrl?: string }
  return result.signedUrl ?? null
}

export async function uploadVerificationDocuments(files: Array<{ documentType: string; file: File }>, userId: string) {
  return Promise.all(files.map(async ({ documentType, file }) => ({ document_type: documentType, document_path: await uploadVerificationDocument(file, userId) })))
}

export async function getSellerDocumentRequirements(listingMode: ListingMode, businessType: BusinessType, sector: string) {
  const { data, error } = await supabase.rpc('get_seller_document_requirements', { p_listing_mode: listingMode, p_business_type: businessType, p_sector: sector })
  if (error) throw error
  return (data ?? []) as Array<{ document_type: string; document_label: string; help_text: string; required: boolean; sort_order: number }>
}

export async function submitSellerRegistrationV2(params: {
  userId: string
  listingMode: ListingMode
  businessType: BusinessType
  sector: string
  fullName: string
  phone: string
  nidOrBusinessNumber: string
  businessName: string | null
  shopName: string
  shopUsername: string
  address: string
  documents: Array<{ document_type: string; document_path: string }>
}): Promise<string> {
  const { data, error } = await supabase.rpc('submit_seller_registration_v3', {
    p_user_id: params.userId,
    p_listing_mode: params.listingMode,
    p_business_type: params.businessType,
    p_sector: params.sector,
    p_full_name: params.fullName,
    p_phone: params.phone,
    p_nid_or_business_number: params.nidOrBusinessNumber,
    p_business_name: params.businessName,
    p_shop_name: params.shopName,
    p_shop_username: params.shopUsername,
    p_address: params.address,
    p_documents: params.documents,
  })
  if (error) throw error
  return data as string
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
