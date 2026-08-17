export interface ChatThread {
  id: string
  buyer_id: string
  seller_id: string
  product_id: string | null
  last_message: string
  last_message_at: string
  buyer_unread_count: number
  seller_unread_count: number
  created_at: string
}

export interface ChatMessage {
  id: string
  thread_id: string
  sender_id: string
  text: string
  created_at: string
}

export type SellerType = 'INDIVIDUAL' | 'BUSINESS'
export type ListingMode = 'DIGITAL' | 'PHYSICAL'
export type BusinessType = 'PERSONAL' | 'BUSINESS' | 'COMPANY'
export type RegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type DocumentReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface SellerRegistration {
  id: string
  user_id: string
  seller_type: SellerType
  full_name: string
  phone: string
  nid_or_business_number: string
  business_name: string | null
  address: string
  document_path: string
  status: RegistrationStatus
  admin_note: string | null
  submitted_at: string
  reviewed_at: string | null
  listing_mode?: ListingMode
  business_type?: BusinessType
  sector?: string
}

export interface SellerVerificationDocument {
  id: string
  registration_id: string
  document_type: string
  document_path: string
  status: DocumentReviewStatus
  admin_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  submitted_at: string
}
