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
  location: string
  images: string[]
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
      location: typeof value.location === 'string' ? value.location : '',
      images: Array.isArray(value.images) ? value.images.filter((image): image is string => typeof image === 'string') : [],
      savedAt: typeof value.savedAt === 'string' ? value.savedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function clearListingDraft() {
  localStorage.removeItem(STORAGE_KEY)
}
