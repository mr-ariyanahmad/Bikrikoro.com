export interface Category {
  id: string
  name: string
  icon_url: string | null
  sort_order: number
}

export type DigitalSpecFieldType = 'text' | 'textarea' | 'number' | 'select' | 'boolean'

export interface DigitalSpecField {
  key: string
  label_bn: string
  label_en?: string
  type: DigitalSpecFieldType
  required?: boolean
  options?: string[]
}

export interface DigitalCategoryTemplate {
  category_id: string
  name_bn: string
  name_en: string
  description_bn: string
  icon_key: string
  parent_category_id: string | null
  fields: DigitalSpecField[]
  sort_order: number
  is_active: boolean
}

export interface ProductDigitalSpecs {
  product_id: string
  seller_id?: string
  specifications: Record<string, unknown>
  auto_delivery_enabled: boolean
  deactivate_when_out_of_stock: boolean
  stock_mode: 'UNLIMITED' | 'QUANTITY' | 'KEY_POOL'
  stock_quantity: number
  fulfillment_window_minutes: number
  region_code: string
  subscription_period: string
  warranty_period: string
  delivery_note: string
  updated_at: string
}

export interface Product {
  id: string
  title: string
  description: string
  price: number
  original_price: number | null
  images: string[]
  video_url?: string | null
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
  latitude?: number | null
  longitude?: number | null
  created_at: string
  approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED'
  approval_note?: string
  approval_reviewed_email?: string | null
  is_hidden?: boolean
}

export interface Profile {
  id: string
  name: string
  phone: string | null
  email: string | null
  photo_url: string | null
  shop_name?: string | null
  shop_description?: string | null
  shop_username?: string | null
  shop_cover_url?: string | null
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
