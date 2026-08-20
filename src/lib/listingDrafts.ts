export interface ListingDraft {
  title: string
  description: string
  price: string
  originalPrice: string
  categoryId: string
  condition: 'NEW' | 'USED'
  isDigital: boolean
  supportsCod: boolean
  freeDelivery: boolean
  fastDelivery: boolean
  freeReturn: boolean
  digitalDeliveryType: 'INSTRUCTIONS' | 'LICENSE_KEY' | 'DOWNLOAD_LINK'
  digitalDeliveryText: string
  specifications: Record<string, unknown>
  autoDeliveryEnabled: boolean
  deactivateWhenOutOfStock: boolean
  stockMode: 'UNLIMITED' | 'QUANTITY' | 'KEY_POOL'
  stockQuantity: string
  fulfillmentWindowMinutes: string
  regionCode: string
  subscriptionPeriod: string
  warrantyPeriod: string
  deliveryNote: string
  location: string
  images: string[]
  videoUrl: string
  savedAt: string
}

const STORAGE_KEY = 'bikrikoro:listing-draft'

type DraftInput = Omit<ListingDraft, 'savedAt'>

export function saveListingDraft(draft: DraftInput) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }))
}

export function loadListingDraft(): ListingDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ListingDraft> | null
    if (!value || typeof value !== 'object' || typeof value.title !== 'string') return null
    return {
      title: value.title,
      description: typeof value.description === 'string' ? value.description : '',
      price: typeof value.price === 'string' ? value.price : '',
      originalPrice: typeof value.originalPrice === 'string' ? value.originalPrice : '',
      categoryId: typeof value.categoryId === 'string' ? value.categoryId : '',
      condition: value.condition === 'NEW' ? 'NEW' : 'USED',
      isDigital: Boolean(value.isDigital),
      supportsCod: Boolean(value.supportsCod),
      freeDelivery: Boolean(value.freeDelivery),
      fastDelivery: Boolean(value.fastDelivery),
      freeReturn: Boolean(value.freeReturn),
      digitalDeliveryType: value.digitalDeliveryType === 'LICENSE_KEY' || value.digitalDeliveryType === 'DOWNLOAD_LINK' ? value.digitalDeliveryType : 'INSTRUCTIONS',
      digitalDeliveryText: typeof value.digitalDeliveryText === 'string' ? value.digitalDeliveryText : '',
      specifications: value.specifications && typeof value.specifications === 'object' && !Array.isArray(value.specifications) ? value.specifications as Record<string, unknown> : {},
      autoDeliveryEnabled: value.autoDeliveryEnabled !== false,
      deactivateWhenOutOfStock: Boolean(value.deactivateWhenOutOfStock),
      stockMode: value.stockMode === 'QUANTITY' || value.stockMode === 'KEY_POOL' ? value.stockMode : 'UNLIMITED',
      stockQuantity: typeof value.stockQuantity === 'string' ? value.stockQuantity : '',
      fulfillmentWindowMinutes: typeof value.fulfillmentWindowMinutes === 'string' ? value.fulfillmentWindowMinutes : '',
      regionCode: typeof value.regionCode === 'string' ? value.regionCode : 'GLOBAL',
      subscriptionPeriod: typeof value.subscriptionPeriod === 'string' ? value.subscriptionPeriod : '',
      warrantyPeriod: typeof value.warrantyPeriod === 'string' ? value.warrantyPeriod : '',
      deliveryNote: typeof value.deliveryNote === 'string' ? value.deliveryNote : '',
      location: typeof value.location === 'string' ? value.location : '',
      images: Array.isArray(value.images) ? value.images.filter((image): image is string => typeof image === 'string') : [],
      videoUrl: typeof value.videoUrl === 'string' ? value.videoUrl : '',
      savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function clearListingDraft() {
  localStorage.removeItem(STORAGE_KEY)
}
