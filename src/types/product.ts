export interface Category {
  id: string
  name: string
  icon_url: string | null
  sort_order: number
}

export interface Product {
  id: string
  title: string
  description: string
  price: number
  original_price: number | null
  images: string[]
  category_id: string
  condition: 'NEW' | 'USED'
  location: string
  is_digital: boolean
  seller_id: string
  view_count: number
  is_escrow_protected: boolean
  supports_cod?: boolean
  free_delivery?: boolean
  fast_delivery?: boolean
  free_return?: boolean
  latitude: number | null
  longitude: number | null
  created_at: string
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED'
  approval_note?: string
  approval_reviewed_email?: string | null
}

export interface Profile {
  id: string
  name: string
  phone: string | null
  email: string | null
  photo_url: string | null
  is_verified: boolean
  rating: number
  review_count: number
  created_at: string
}

export interface PromoBanner {
  id: string
  image_url: string
  target_category_id: string | null
  target_product_id: string | null
  sort_order: number
}
