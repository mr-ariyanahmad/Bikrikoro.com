export interface ListingDraft {
  title: string
  description: string
  price: string
  originalPrice: string
  categoryId: string
  condition: 'NEW' | 'USED'
  isDigital: boolean
  location: string
  images: string[]
  savedAt: string
}

const STORAGE_KEY = 'bikrikoro:listing-draft'

export function saveListingDraft(draft: Omit<ListingDraft, 'savedAt'>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, savedAt: new Date().toISOString() }))
}

export function loadListingDraft(): ListingDraft | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!value || typeof value !== 'object' || typeof value.title !== 'string') return null
    return value as ListingDraft
  } catch {
    return null
  }
}

export function clearListingDraft() {
  localStorage.removeItem(STORAGE_KEY)
}
