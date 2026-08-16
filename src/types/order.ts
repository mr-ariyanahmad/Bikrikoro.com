export type OrderStatus = 'PENDING_PAYMENT' | 'ESCROW_HELD' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'

export type PaymentMethod = 'BKASH' | 'NAGAD' | 'CARD' | 'CASH_ON_MEETUP'

export type DisputeReason =
  | 'NOT_RECEIVED'
  | 'DAMAGED'
  | 'FAKE_OR_COUNTERFEIT'
  | 'NOT_AS_DESCRIBED'
  | 'WRONG_ITEM'
  | 'OTHER'

export type DisputeStatus = 'REPORTED' | 'UNDER_REVIEW' | 'RESOLVED_REFUNDED' | 'RESOLVED_DENIED'

export interface Order {
  id: string
  product_id: string
  product_title: string
  product_image: string
  price: number
  quantity: number
  seller_id: string
  buyer_id: string
  delivery_address: string
  payment_method: PaymentMethod
  status: OrderStatus
  escrow_fee: number
  dispute_status: DisputeStatus | null
  created_at: string
}

export interface OrderDispute {
  id: string
  order_id: string
  buyer_id: string
  reason: DisputeReason
  description: string
  evidence_urls: string[]
  status: DisputeStatus
  resolution_note: string | null
  created_at: string
  resolved_at: string | null
}

export interface DisputeMessage {
  id: string
  dispute_id: string
  sender_id: string
  sender_role: 'BUYER' | 'SUPPORT'
  message: string
  created_at: string
}

export interface Review {
  id: string
  order_id: string
  product_id: string
  product_title: string
  seller_id: string
  buyer_id: string
  buyer_name: string
  rating: number
  comment: string
  created_at: string
}
