import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, ClipboardCheck, ShieldCheck } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { BrandSelect } from '@/components/BrandSelect'
import { ImageUploader } from '@/components/ImageUploader'
import { uploadProductImages } from '@/lib/storage'
import { clearListingDraft, loadListingDraft, saveListingDraft } from '@/lib/listingDrafts'
import type { DigitalCategoryTemplate, Product, ProductDigitalSpecs } from '@/types/product'
import { isYouTubeUrl } from '@/lib/youtube'

interface LocalImage {
  url: string
  file?: File
  uploading?: boolean
}

type DigitalContent = {
  delivery_type: 'INSTRUCTIONS' | 'LICENSE_KEY' | 'DOWNLOAD_LINK'
  delivery_text: string
}

type ListingOptionsPayload = {
  options?: ProductDigitalSpecs | null
  content?: DigitalContent | null
  availableKeyCount?: number
  added?: number
  error?: string
}

const FIELD_OPTIONS: Record<string, string[]> = {
  platform: ['Steam', 'Epic Games', 'PlayStation', 'Xbox', 'Android', 'iOS', 'Both', 'Windows', 'macOS', 'Web', 'Other'],
  region_code: ['GLOBAL', 'BD', 'INDIA', 'US', 'EU', 'ASIA', 'MENA', 'LATAM', 'Other'],
  subscription_period: ['30 Days', '90 Days', '6 Months', '1 Year', 'Lifetime', 'No Expiry', 'Custom'],
  warranty_period: ['7 Days', '15 Days', '30 Days', 'Replacement only', 'No Warranty', 'Custom'],
  login_method: ['Google', 'Facebook', 'Apple', 'Email', 'Game ID', 'Other'],
  activation_method: ['Redeem code', 'Account activation', 'Email activation', 'Manual activation', 'Other'],
  delivery_method: ['Automatic', 'Manual', 'Automatic + Manual'],
  license_type: ['Personal use', 'Commercial use', 'Extended commercial use', 'Subscription', 'Other'],
  file_format: ['PDF', 'DOCX', 'PPTX', 'XLSX', 'PSD', 'AI', 'Figma', 'ZIP', 'MP4', 'MP3', 'Other'],
  language: ['বাংলা', 'English', 'Hindi', 'Arabic', 'Multi-language', 'Other'],
  editable: ['Editable', 'Non-editable'],
  account_type: ['Personal', 'Family', 'Team', 'Business', 'Other'],
  key_type: ['Digital key', 'Activation code', 'Voucher code', 'Serial key', 'Other'],
  redeem_method: ['Website', 'App', 'In-game', 'Email', 'Other'],
  currency: ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'Other'],
  expiry: ['No Expiry', '30 Days', '90 Days', '1 Year', 'Custom'],
  duration: ['7 Days', '30 Days', '90 Days', '1 Year', 'Lifetime', 'Custom'],
}

function secureDeliveryCopy(template?: DigitalCategoryTemplate) {
  const key = template?.category_id.toLowerCase() ?? ''
  if (key.includes('game') || key.includes('account')) return { label: 'Account credentials / secure delivery', placeholder: 'Email, password, recovery information অথবা account handover instructions লিখুন।' }
  if (key.includes('key') || key.includes('activation')) return { label: 'Activation key / code', placeholder: 'Secret key, activation code বা redemption code লিখুন।' }
  if (key.includes('gift') || key.includes('voucher')) return { label: 'Voucher / redemption information', placeholder: 'Voucher code, redemption link এবং redeem করার ধাপ লিখুন।' }
  if (key.includes('course') || key.includes('ebook') || key.includes('file') || key.includes('template')) return { label: 'Secure download / access information', placeholder: 'Secure download link, file access code অথবা access instructions লিখুন।' }
  return { label: 'Secure delivery information', placeholder: 'Secret key, activation code, account credentials, redemption code অথবা secure download link লিখুন।' }
}

async function digitalContentRequest(body: Record<string, unknown>) {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('Firebase session পাওয়া যায়নি।')
  const response = await fetch('/api/seller-digital-content', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string; content?: DigitalContent | null }
  if (!response.ok) throw new Error(payload.error || 'ডিজিটাল ডেলিভারি তথ্য লোড করা যায়নি।')
  return payload
}

async function sellerProductRequest(body: Record<string, unknown>) {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('Firebase session পাওয়া যায়নি।')
  const response = await fetch('/api/seller-product', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as { error?: string; code?: string; productId?: string }
  if (!response.ok) throw new Error(payload.code === 'DUPLICATE_PENDING_PRODUCT' ? 'DUPLICATE_PENDING_PRODUCT' : (payload.error || 'পণ্য সেভ করা যায়নি।'))
  return payload
}

async function sellerListingOptionsRequest(body: Record<string, unknown>) {
  const idToken = await auth.currentUser?.getIdToken()
  if (!idToken) throw new Error('Firebase session পাওয়া যায়নি।')
  const response = await fetch('/api/seller-listing-options', {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({})) as ListingOptionsPayload
  if (!response.ok) throw new Error(payload.error || 'লিস্টিং-এর অতিরিক্ত তথ্য সেভ করা যায়নি।')
  return payload
}

function hasSpecValue(value: unknown) {
  if (typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.length > 0
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value)
}

export default function Sell() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [categoryTemplates, setCategoryTemplates] = useState<DigitalCategoryTemplate[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [condition, setCondition] = useState<'NEW' | 'USED'>('NEW')
  const [images, setImages] = useState<LocalImage[]>([])
  const [videoUrl, setVideoUrl] = useState('')
  const [digitalDeliveryType, setDigitalDeliveryType] = useState<DigitalContent['delivery_type']>('INSTRUCTIONS')
  const [digitalDeliveryText, setDigitalDeliveryText] = useState('')
  const [specifications, setSpecifications] = useState<Record<string, unknown>>({})
  const [autoDeliveryEnabled, setAutoDeliveryEnabled] = useState(true)
  const [deactivateWhenOutOfStock, setDeactivateWhenOutOfStock] = useState(false)
  const [stockMode, setStockMode] = useState<'UNLIMITED' | 'QUANTITY' | 'KEY_POOL'>('UNLIMITED')
  const [stockQuantity, setStockQuantity] = useState('')
  const [fulfillmentWindowMinutes, setFulfillmentWindowMinutes] = useState('')
  const [regionCode, setRegionCode] = useState('GLOBAL')
  const [subscriptionPeriod, setSubscriptionPeriod] = useState('')
  const [warrantyPeriod, setWarrantyPeriod] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [availableKeyCount, setAvailableKeyCount] = useState(0)
  const [keyBatchText, setKeyBatchText] = useState('')
  const [loadingExisting, setLoadingExisting] = useState(isEditing)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftMessage, setDraftMessage] = useState<string | null>(null)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [digitalVerified, setDigitalVerified] = useState(false)
  const [digitalVerificationLoading, setDigitalVerificationLoading] = useState(true)
  const [archivedPhysical, setArchivedPhysical] = useState(false)
  const [step, setStep] = useState(1)
  const [reviewing, setReviewing] = useState(false)
  const [savedDraft, setSavedDraft] = useState<ReturnType<typeof loadListingDraft>>(null)
  const [showDraftCard, setShowDraftCard] = useState(false)

  useEffect(() => {
    let active = true
    const loadTemplates = async () => {
      const [{ data, error: templateError }, { data: categoryRows }] = await Promise.all([
        supabase.from('digital_category_templates').select('category_id, name_en, description_bn, icon_key, parent_category_id, fields, sort_order, is_active').eq('is_active', true).order('sort_order'),
        supabase.from('categories').select('id, name, sort_order').order('sort_order'),
      ])
      if (!active) return
      const categoryNames = new Map((categoryRows ?? []).map((category) => [category.id, category.name]))
      if (!templateError && data && data.length > 0) {
        const templates = data.map((template) => ({ ...template, name_bn: categoryNames.get(template.category_id) ?? template.category_id })) as DigitalCategoryTemplate[]
        setCategoryTemplates(templates)
        return
      }
      if (!active) return
      const fallback = (categoryRows ?? []).map((category) => ({
        category_id: category.id,
        name_bn: category.name,
        name_en: '',
        description_bn: '',
                  icon_key: 'Package',
          parent_category_id: null,

        fields: [],
        sort_order: category.sort_order,
        is_active: true,
      })) as DigitalCategoryTemplate[]
      setCategoryTemplates(fallback)
    }
    void loadTemplates()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!user) {
      setDigitalVerificationLoading(false)
      return
    }
    let active = true
    const loadDigitalStatus = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('Firebase session পাওয়া যায়নি।')
        const response = await fetch('/api/seller-verification-status', { headers: { Authorization: `Bearer ${idToken}` } })
        const payload = await response.json().catch(() => ({})) as { digitalVerified?: boolean }
        if (!response.ok) throw new Error('Seller verification status লোড করা যায়নি।')
        if (active) setDigitalVerified(payload.digitalVerified === true)
      } catch (statusError) {
        console.error('Digital seller eligibility check failed:', statusError)
        if (active) setDigitalVerified(false)
      } finally {
        if (active) setDigitalVerificationLoading(false)
      }
    }
    void loadDigitalStatus()
    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (isEditing || !user) return
    const draft = loadListingDraft()
    if (!draft) return
    setSavedDraft(draft)
    setShowDraftCard(true)
    setTitle(draft.title)
    setDescription(draft.description)
    setPrice(draft.price)
    setOriginalPrice(draft.originalPrice)
    setCategoryId(draft.categoryId)
    setCondition(draft.condition)
    setDigitalDeliveryType(draft.digitalDeliveryType)
    setDigitalDeliveryText(draft.digitalDeliveryText)
    setSpecifications(draft.specifications)
    setAutoDeliveryEnabled(draft.autoDeliveryEnabled)
    setDeactivateWhenOutOfStock(draft.deactivateWhenOutOfStock)
    setStockMode(draft.stockMode)
    setStockQuantity(draft.stockQuantity)
    setFulfillmentWindowMinutes(draft.fulfillmentWindowMinutes)
    setRegionCode(draft.regionCode)
    setSubscriptionPeriod(draft.subscriptionPeriod)
    setWarrantyPeriod(draft.warrantyPeriod)
    setDeliveryNote(draft.deliveryNote)
    setImages(draft.images.map((url) => ({ url })))
    setVideoUrl(draft.videoUrl)
    setDraftMessage('আগের অসম্পূর্ণ ডিজিটাল ড্রাফট লোড হয়েছে।')
  }, [isEditing, user])

  useEffect(() => {
    if (!id || !user) return
    let active = true
    const loadListing = async () => {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) { setError('আপনার Firebase সেশন পাওয়া যায়নি। আবার লগইন করুন।'); setLoadingExisting(false); return }
      const response = await fetch('/api/seller-listings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'get', productId: id }) })
      const payload = await response.json().catch(() => ({})) as { product?: Product; error?: string }
      const data = payload.product
      const fetchError = response.ok ? null : new Error(payload.error || 'Listing load failed')
      if (!active) return
      if (fetchError || !data || data.seller_id !== user.uid) {
        setError('এই লিস্টিং খুঁজে পাওয়া যায়নি বা এটি আপনার নয়।')
        setLoadingExisting(false)
        return
      }
      if (data.is_digital !== true) {
        setArchivedPhysical(true)
        setLoadingExisting(false)
        return
      }
      setTitle(data.title)
      setDescription(data.description)
      setPrice(String(data.price))
      setOriginalPrice(data.original_price ? String(data.original_price) : '')
      setCategoryId(data.category_id)
      setCondition(data.condition)
      setImages((data.images ?? []).map((url: string) => ({ url })))
      setVideoUrl(data.video_url || '')
      try {
        const [payload, optionsPayload] = await Promise.all([
          digitalContentRequest({ action: 'get', productId: id }),
          sellerListingOptionsRequest({ action: 'get', productId: id }),
        ])
        const delivery = payload.content
        if (delivery) {
          setDigitalDeliveryType(delivery.delivery_type)
          setDigitalDeliveryText(delivery.delivery_text || '')
        }
        const options = optionsPayload.options
        if (options) {
          setSpecifications(options.specifications || {})
          setAutoDeliveryEnabled(options.auto_delivery_enabled)
          setDeactivateWhenOutOfStock(options.deactivate_when_out_of_stock)
          setStockMode(options.stock_mode)
          setStockQuantity(options.stock_quantity ? String(options.stock_quantity) : '')
          setFulfillmentWindowMinutes(options.fulfillment_window_minutes ? String(options.fulfillment_window_minutes) : '')
          setRegionCode(options.region_code || 'GLOBAL')
          setSubscriptionPeriod(options.subscription_period || '')
          setWarrantyPeriod(options.warranty_period || '')
          setDeliveryNote(options.delivery_note || '')
          setAvailableKeyCount(optionsPayload.availableKeyCount ?? 0)
        }
      } catch (contentError) {
        console.error('Digital delivery options load failed:', contentError)
        setError(contentError instanceof Error ? contentError.message : 'ডেলিভারি তথ্য লোড করা যায়নি।')
      } finally {
        if (active) setLoadingExisting(false)
      }
    }
    void loadListing()
    return () => { active = false }
  }, [id, user])

  const handleSaveDraft = () => {
    saveListingDraft({
      title,
      description,
      price,
      originalPrice,
      categoryId,
      condition,
      isDigital: true,
      supportsCod: false,
      freeDelivery: false,
      fastDelivery: false,
      freeReturn: false,
      digitalDeliveryType,
      digitalDeliveryText,
      specifications: normalizedSpecifications,
      autoDeliveryEnabled,
      deactivateWhenOutOfStock,
      stockMode,
      stockQuantity,
      fulfillmentWindowMinutes,
      regionCode,
      subscriptionPeriod,
      warrantyPeriod,
      deliveryNote,
      location: '',
      images: images.filter((image) => !image.uploading).map((image) => image.url),
      videoUrl,
    })
    setSavedDraft(loadListingDraft())
    setShowDraftCard(true)
    setDraftMessage('ডিজিটাল লিস্টিং ড্রাফট সেভ হয়েছে।')
  }

  const handleClearDraft = () => {
    clearListingDraft()
    setSavedDraft(null)
    setShowDraftCard(false)
    setDraftMessage('ড্রাফট মুছে ফেলা হয়েছে।')
  }

  const handleAddImages = async (files: File[]) => {
    if (!user) return
    const placeholders: LocalImage[] = files.map((file) => ({
      url: URL.createObjectURL(file),
      file,
      uploading: true,
    }))
    setImages((prev) => [...prev, ...placeholders])
    try {
      const urls = await uploadProductImages(files, user.uid)
      setImages((prev) => prev.map((image) => {
        const placeholderIndex = placeholders.findIndex((placeholder) => placeholder.url === image.url)
        return placeholderIndex >= 0 ? { url: urls[placeholderIndex] } : image
      }))
      placeholders.forEach((placeholder) => URL.revokeObjectURL(placeholder.url))
    } catch (uploadError) {
      console.error('Image upload failed:', uploadError)
      setError(uploadError instanceof Error ? uploadError.message : 'ছবি আপলোড করা যায়নি — আবার চেষ্টা করুন।')
      placeholders.forEach((placeholder) => URL.revokeObjectURL(placeholder.url))
      setImages((prev) => prev.filter((image) => !placeholders.some((placeholder) => placeholder.url === image.url)))
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      const target = prev[index]
      if (target?.url.startsWith('blob:')) URL.revokeObjectURL(target.url)
      return prev.filter((_, imageIndex) => imageIndex !== index)
    })
  }

  const handleAddLicenseKeys = async () => {
    if (!id || !keyBatchText.trim()) return
    try {
      const payload = await sellerListingOptionsRequest({ action: 'add-keys', productId: id, keys: keyBatchText.split(/\\r?\\n/).map((value) => value.trim()).filter(Boolean) })
      setAvailableKeyCount((count) => count + Number(payload.added ?? 0))
      setKeyBatchText('')
      setError(`${payload.added ?? 0}টি key inventory-তে যোগ হয়েছে।`)
    } catch (keyError) {
      setError(keyError instanceof Error ? keyError.message : 'Key inventory সেভ করা যায়নি।')
    }
  }

  const selectedTemplate = categoryTemplates.find((template) => template.category_id === categoryId)
  const normalizedSpecifications = selectedTemplate?.fields.some((field) => field.key === 'game_name') ? { ...specifications, game_name: title.trim() } : specifications
  const missingRequiredFields = (selectedTemplate?.fields ?? []).filter((field) => field.required && !hasSpecValue(normalizedSpecifications[field.key]))
  const isValid =
    digitalVerified &&
    title.trim().length >= 5 &&
    Number(price) > 0 &&
    Boolean(categoryId) &&
    missingRequiredFields.length === 0 &&
    digitalDeliveryText.trim().length >= 3 &&
    images.length > 0 &&
    !images.some((image) => image.uploading) &&
    (!videoUrl.trim() || isYouTubeUrl(videoUrl)) &&
    (stockMode !== 'QUANTITY' || Number(stockQuantity) > 0) &&
    (stockMode !== 'KEY_POOL' || digitalDeliveryType === 'LICENSE_KEY')

  const handleSubmit = async () => {
    if (!user || !isValid || digitalVerificationLoading) return
    setSubmitting(true)
    setError(null)
    setPendingMessage(null)
    try {
      if (!digitalVerified) throw new Error('পণ্য প্রকাশের আগে email verification ও Basic Seller setup সম্পন্ন করুন।')
      if (videoUrl.trim() && !isYouTubeUrl(videoUrl)) throw new Error('শুধু valid YouTube video link দেওয়া যাবে।')

      const payload = {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        original_price: originalPrice ? Number(originalPrice) : null,
        category_id: categoryId,
        condition,
        images: images.map((image) => image.url),
        video_url: videoUrl.trim() || null,
      }

      const result = await sellerProductRequest({
        action: isEditing ? 'update' : 'create',
        productId: isEditing ? id : undefined,
        title: payload.title,
        description: payload.description,
        price: payload.price,
        originalPrice: payload.original_price,
        categoryId: payload.category_id,
        condition: payload.condition,
        images: payload.images,
        videoUrl: payload.video_url,
      })

      const savedProductId = result.productId
      if (!savedProductId) throw new Error('সেভ হওয়া পণ্যের ID পাওয়া যায়নি।')
      await digitalContentRequest({
        action: 'save',
        productId: savedProductId,
        deliveryType: digitalDeliveryType,
        deliveryText: digitalDeliveryText.trim(),
      })
      await sellerListingOptionsRequest({
        action: 'save',
        productId: savedProductId,
        specifications: normalizedSpecifications,
        autoDeliveryEnabled,
        deactivateWhenOutOfStock,
        stockMode,
        stockQuantity: Number(stockQuantity || 0),
        fulfillmentWindowMinutes: Number(fulfillmentWindowMinutes || 0),
        regionCode,
        subscriptionPeriod,
        warrantyPeriod,
        deliveryNote,
      })

      clearListingDraft()
      navigate('/my-listings')
    } catch (submitError) {
      console.error('Product save failed:', submitError)
      const message = submitError instanceof Error ? submitError.message : ''
      if (message === 'DUPLICATE_PENDING_PRODUCT') {
        setPendingMessage('এই শিরোনাম ও বিবরণসহ একটি প্রোডাক্ট ইতিমধ্যে যাচাইয়ের জন্য জমা হয়েছে। অনুগ্রহ করে অপেক্ষা করুন—যাচাই সম্পন্ন হলে আপনার প্রোডাক্টটি ওয়েবসাইটে লাইভ দেখাবে।')
      } else {
        setError(message ? `সেভ করা যায়নি — ${message}` : 'পণ্য সেভ করা যায়নি।')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const validateStep = (targetStep: number) => {
    if (targetStep >= 1) {
      if (!categoryId) return 'ক্যাটাগরি নির্বাচন করুন।'
      if (images.length === 0) return 'কমপক্ষে একটি product image যোগ করুন।'
      if (images.some((image) => image.uploading)) return 'ছবি আপলোড হওয়া পর্যন্ত অপেক্ষা করুন।'
      if (title.trim().length < 5) return 'Product title কমপক্ষে ৫ অক্ষরের দিন।'
      if (description.trim().length < 10) return 'Product description আরও বিস্তারিত লিখুন।'
      if (Number(price) <= 0) return 'Product price দিন।'
      if (videoUrl.trim() && !isYouTubeUrl(videoUrl)) return 'শুধু valid YouTube video link দেওয়া যাবে।'
    }
    if (targetStep >= 2 && missingRequiredFields.length > 0) return `${missingRequiredFields.map((field) => field.label_bn).join(', ')} পূরণ করুন।`
    if (targetStep >= 3) {
      if (!digitalDeliveryText.trim() || digitalDeliveryText.trim().length < 3) return 'Secure delivery information দিন।'
      if (stockMode === 'QUANTITY' && Number(stockQuantity) < 1) return 'Stock quantity কমপক্ষে ১ দিন।'
      if (stockMode === 'KEY_POOL' && digitalDeliveryType !== 'LICENSE_KEY') return 'Key pool-এর জন্য License / activation key delivery নির্বাচন করুন।'
    }
    return null
  }

  const goToStep = (nextStep: number) => {
    const validation = nextStep > step ? validateStep(nextStep - 1) : null
    if (validation) { setError(validation); return }
    setError(null)
    setReviewing(false)
    const safeStep = Math.max(1, Math.min(3, nextStep))
    setStep(safeStep)
    window.requestAnimationFrame(() => document.getElementById('listing-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  if (loadingExisting || digitalVerificationLoading) {
    return <Layout wide><div className="mx-auto max-w-3xl animate-pulse border border-outline bg-surface p-8"><div className="h-6 w-48 bg-outline/50" /><div className="mt-4 h-32 bg-outline/30" /></div></Layout>
  }

  if (archivedPhysical) {
    return (
      <Layout wide>
        <div className="mx-auto max-w-xl border border-outline bg-surface p-6 text-center">
          <ShieldCheck className="mx-auto text-brand-600" size={32} />
          <h1 className="mt-3 text-lg font-bold text-ink-900">এই পুরনো তালিকাটি সংরক্ষণ করা হয়েছে</h1>
          <p className="mt-2 text-sm leading-6 text-ink-600">BikriKoro এখন শুধু ডিজিটাল পণ্যের বাজার। পুরনো তালিকাটি আপনার রেকর্ডের জন্য সংরক্ষিত আছে।</p>
        </div>
      </Layout>
    )
  }

  if (!digitalVerified) {
    return (
      <Layout wide>
        <div className="mx-auto max-w-xl border border-brand-200 bg-brand-50 p-6 text-center">
          <ShieldCheck className="mx-auto text-brand-600" size={34} />
          <h1 className="mt-3 text-lg font-bold text-ink-900">ডিজিটাল বিক্রেতার যাচাই প্রয়োজন</h1>
          <p className="mt-2 text-sm leading-6 text-ink-700">পণ্য প্রকাশের আগে email verify করে Basic Seller setup সম্পন্ন করুন। NID ও selfie এখনই প্রয়োজন নেই।</p>
          <button type="button" onClick={() => navigate('/become-seller')} className="mt-5 bg-brand-500 px-4 py-3 text-base font-semibold text-white">যাচাই শুরু করুন</button>
        </div>
      </Layout>
    )
  }

  const renderSpecField = (field: DigitalCategoryTemplate['fields'][number]) => {
    const rawValue = specifications[field.key]
    const value = typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean' ? rawValue : ''
    const setValue = (next: unknown) => setSpecifications((current) => ({ ...current, [field.key]: next }))
    const label = `${field.label_bn}${field.required ? ' *' : ''}`
    const options = field.options?.length ? field.options : FIELD_OPTIONS[field.key]
    if (field.type === 'select' || options) return <BrandSelect key={field.key} label={label} value={String(value)} options={(options ?? []).map((option) => ({ value: option, label: option }))} onChange={setValue} placeholder="বেছে নিন" />
    if (field.type === 'textarea') return <label key={field.key} className="text-sm text-ink-700 sm:col-span-2"><span className="mb-1.5 block font-medium text-ink-900">{label}</span><textarea value={String(value)} onChange={(event) => setValue(event.target.value)} rows={3} className="w-full rounded-lg border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>
    if (field.type === 'number') return <label key={field.key} className="text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">{label}</span><input type="number" value={value === '' ? '' : String(value)} onChange={(event) => setValue(event.target.value ? Number(event.target.value) : '')} className="w-full rounded-lg border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>
    if (field.type === 'boolean') return <button key={field.key} type="button" aria-pressed={value === true} onClick={() => setValue(value !== true)} className={`flex min-h-11 items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm ${value === true ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline bg-surface text-ink-600'}`}><span>{label}</span><span className="text-xs font-semibold">{value === true ? 'হ্যাঁ' : 'না'}</span></button>
    return <label key={field.key} className="text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">{label}</span><input type="text" value={String(value)} onChange={(event) => setValue(event.target.value)} className="w-full rounded-lg border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>
  }

  const steps = [
    { number: 1, label: 'Basic', description: 'আপনার পণ্যের মূল তথ্য দিন' },
    { number: 2, label: 'Details', description: 'পণ্যের ধরন অনুযায়ী প্রয়োজনীয় তথ্য দিন' },
    { number: 3, label: 'Delivery', description: 'স্টক, ডেলিভারি ও ক্রেতা কী পাবেন তা নির্ধারণ করুন' },
  ]

  const reviewRows = [
    ['Category', selectedTemplate?.name_bn || '—'],
    ['Price', price ? `৳ ${price}` : '—'],
    ['Region', regionCode || 'GLOBAL'],
    ['Validity', subscriptionPeriod || 'No expiry দেওয়া হয়নি'],
    ['Warranty', warrantyPeriod || 'No warranty দেওয়া হয়নি'],
    ['Delivery', autoDeliveryEnabled ? 'Automatic' : 'Manual'],
    ['Delivery time', `${fulfillmentWindowMinutes || (autoDeliveryEnabled ? '0' : 'Not set')} minutes`],
    ['Stock', stockMode === 'QUANTITY' ? `${stockQuantity || 0} items` : stockMode === 'KEY_POOL' ? `${availableKeyCount} keys` : 'Unlimited'],
  ]
  const deliveryCopy = secureDeliveryCopy(selectedTemplate)

  return (
    <Layout wide>
      <div id="listing-form" className="mx-auto max-w-6xl scroll-mt-24">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm font-semibold text-brand-700">Seller workspace</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-ink-900">{isEditing ? 'লিস্টিং এডিট করুন' : 'নতুন লিস্টিং তৈরি করুন'}</h1><p className="mt-1 text-sm text-ink-500">কম ধাপে আপনার digital product-এর একটি professional listing তৈরি করুন।</p></div>
          <div className="flex gap-2"><button type="button" onClick={handleSaveDraft} className="rounded-lg border border-outline px-3 py-2 text-sm font-semibold text-ink-700 hover:border-brand-500 hover:text-brand-700">Save Draft</button>{!isEditing && <button type="button" onClick={handleClearDraft} className="rounded-lg border border-error/30 px-3 py-2 text-sm font-semibold text-error hover:bg-error/5">ড্রাফট মুছুন</button>}</div>
        </div>
        {draftMessage && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{draftMessage}</p>}
        {pendingMessage && <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-amber-600" /><p><strong>প্রোডাক্টটি আগে থেকেই জমা আছে।</strong><br />{pendingMessage}</p></div>}
        {savedDraft && showDraftCard && !isEditing && <section className="mt-5 overflow-hidden rounded-xl border border-brand-200 bg-surface shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 bg-brand-50/60 px-4 py-3"><div><p className="text-xs font-bold uppercase tracking-wide text-brand-700">Saved draft</p><h2 className="mt-0.5 text-base font-bold text-ink-900">আপনার অসম্পূর্ণ লিস্টিং</h2></div><button type="button" onClick={() => setShowDraftCard(false)} className="text-sm font-semibold text-ink-500 hover:text-ink-900">বন্ধ করুন</button></div><div className="flex items-center gap-3 p-4"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-outline bg-bg">{savedDraft.images[0] ? <img src={savedDraft.images[0]} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-ink-400">No image</div>}</div><div className="min-w-0 flex-1"><h3 className="truncate font-bold text-ink-900">{savedDraft.title || 'Untitled product'}</h3><p className="mt-1 text-sm text-ink-500">{categoryTemplates.find((template) => template.category_id === savedDraft.categoryId)?.name_bn || 'Category not selected'} · {savedDraft.price ? `৳ ${savedDraft.price}` : 'Price not set'}</p><p className="mt-1 text-xs text-ink-400">শেষ সেভ: {new Date(savedDraft.savedAt).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><button type="button" onClick={() => { setShowDraftCard(false); setStep(1); setReviewing(false); setDraftMessage('ড্রাফট থেকে editing চালু হয়েছে।') }} className="shrink-0 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-brand-700">Continue edit</button></div></section>}

        <nav aria-label="Listing progress" className="mt-5 border-y border-outline bg-surface py-3 sm:py-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-6">{steps.map((item) => <button type="button" key={item.number} onClick={() => goToStep(item.number)} className="text-left"><div className="flex items-center gap-2"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold ${step === item.number ? 'border-brand-600 bg-brand-600 text-white' : step > item.number ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-outline text-ink-400'}`}>{step > item.number ? <Check size={15} /> : `0${item.number}`}</span><span className={`text-sm font-bold ${step === item.number ? 'text-brand-700' : 'text-ink-700'}`}>{item.label}</span></div><p className="mt-2 hidden text-xs leading-5 text-ink-500 sm:block">{item.description}</p></button>)}</div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-outline/60"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(step / 3) * 100}%` }} /></div>
        </nav>

        {reviewing ? <section className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="border-b border-outline bg-surface py-4 sm:py-5"><div className="flex items-start gap-3"><ClipboardCheck className="mt-0.5 text-brand-600" size={22} /><div><h2 className="text-xl font-bold text-ink-900">আপনার Listing প্রস্তুত</h2><p className="mt-1 text-sm text-ink-500">Publish করার আগে আপনার দেওয়া তথ্যগুলো একবার দেখে নিন।</p></div></div>
            <div className="mt-6 grid gap-5 sm:grid-cols-[160px_1fr]"><div className="aspect-square overflow-hidden rounded-lg border border-outline bg-bg">{images[0] ? <img src={images[0].url} alt="Product preview" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm text-ink-400">ছবি নেই</div>}</div><div><h3 className="text-lg font-bold text-ink-900">{title || 'Untitled product'}</h3><p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-6 text-ink-600">{description || 'কোনো description দেওয়া হয়নি।'}</p><p className="mt-4 text-2xl font-bold text-brand-700">৳ {price || '0'}</p></div></div>
            <div className="mt-6 divide-y divide-outline rounded-lg border border-outline">{reviewRows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><span className="text-ink-500">{label}</span><span className="text-right font-semibold text-ink-800">{value}</span></div>)}</div>
            <div className="mt-5"><h3 className="text-sm font-bold text-ink-900">Product-specific details</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{Object.entries(normalizedSpecifications).filter(([, value]) => hasSpecValue(value)).slice(0, 8).map(([key, value]) => <div key={key} className="rounded-lg bg-bg px-3 py-2 text-sm"><span className="text-xs text-ink-500">{key.replaceAll('_', ' ')}</span><p className="mt-0.5 font-medium text-ink-800">{String(value)}</p></div>)}</div></div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setReviewing(false); setStep(1) }} className="rounded-lg border border-outline px-4 py-3 text-sm font-semibold text-ink-700">Edit Listing</button><button type="button" onClick={() => void handleSubmit()} disabled={!isValid || submitting} className="rounded-lg bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Publish হচ্ছে...' : 'Publish Product'}</button></div>
          </div><aside className="h-fit rounded-xl border border-outline bg-bg p-5 lg:sticky lg:top-24"><p className="text-sm font-bold text-ink-900">Buyer preview</p><div className="mt-3 overflow-hidden rounded-lg border border-outline bg-surface"><div className="aspect-[4/3] bg-bg">{images[0] && <img src={images[0].url} alt="" className="h-full w-full object-cover" />}</div><div className="p-3"><p className="line-clamp-2 text-sm font-semibold text-ink-900">{title || 'Product title'}</p><p className="mt-2 font-bold text-brand-700">৳ {price || '0'}</p><p className="mt-2 text-xs text-ink-500">{selectedTemplate?.name_bn || 'Digital product'} · {regionCode || 'GLOBAL'}</p></div></div></aside>
        </section> : <>
          {step === 1 && <section className="mt-4 border-b border-outline bg-surface py-4 sm:py-5"><div className="mb-4"><h2 className="text-xl font-bold text-ink-900">পণ্যের মূল তথ্য</h2><p className="mt-1 text-sm text-ink-500">আপনার ডিজিটাল পণ্য সম্পর্কে প্রাথমিক তথ্য দিন।</p></div><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-5"><div><label className="mb-1.5 block text-sm font-semibold text-ink-900">Category <span className="text-error">*</span></label><BrandSelect label="" value={categoryId} options={categoryTemplates.map((template) => ({ value: template.category_id, label: template.name_bn }))} onChange={(value) => { setCategoryId(value); setSpecifications({}) }} placeholder="ডিজিটাল ক্যাটাগরি বেছে নিন" disabled={categoryTemplates.length === 0} /></div><div><label className="mb-1.5 block text-sm font-semibold text-ink-900">Product image <span className="text-error">*</span></label><ImageUploader images={images} onAdd={handleAddImages} onRemove={handleRemoveImage} onError={setError} max={8} /><p className="mt-2 text-xs text-ink-500">PNG, JPG বা WEBP · সর্বোচ্চ 8MB · একাধিক ছবি যোগ করা যাবে</p></div><div><label className="mb-1.5 block text-sm font-semibold text-ink-900">Product title <span className="text-error">*</span></label><input type="text" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="যেমন: Canva Pro 1 বছরের access" className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><p className="mt-1 text-xs text-ink-500">{title.length}/120 · পরিষ্কার ও সংক্ষিপ্ত title ব্যবহার করুন</p></div><div><label className="mb-1.5 block text-sm font-semibold text-ink-900">Short description</label><input type="text" maxLength={180} value={description.split('\n')[0] === description ? description.slice(0, 180) : description.split('\n')[0]} onChange={(event) => setDescription(event.target.value)} placeholder="এক লাইনে পণ্যের সংক্ষিপ্ত পরিচয়" className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></div><div><label className="mb-1.5 block text-sm font-semibold text-ink-900">Full description <span className="text-error">*</span></label><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={7} placeholder="Digital product কী, কীভাবে ব্যবহার করবেন, মেয়াদ বা সীমাবদ্ধতা লিখুন" className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><p className="mt-1 text-xs text-ink-500">{description.length} characters · বিস্তারিত, কিন্তু public-safe information দিন</p></div><div><label className="mb-1.5 block text-sm font-semibold text-ink-900">YouTube product video <span className="font-normal text-ink-400">— Optional</span></label><input type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-brand-500 ${videoUrl && !isYouTubeUrl(videoUrl) ? 'border-error' : 'border-outline'}`} /></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-ink-900">Price <span className="text-error">*</span><div className="mt-1.5 flex items-center rounded-lg border border-outline focus-within:border-brand-500"><span className="border-r border-outline px-3 py-2.5 text-sm text-ink-500">BDT ৳</span><input type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} className="tabular-amount min-w-0 flex-1 px-3 py-2.5 text-sm outline-none" /></div></label><label className="text-sm font-semibold text-ink-900">মূল দাম <span className="font-normal text-ink-400">— Optional</span><input type="number" min="0" value={originalPrice} onChange={(event) => setOriginalPrice(event.target.value)} placeholder="ছাড় দেখাতে চাইলে" className="tabular-amount mt-1.5 w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label></div>{selectedTemplate?.fields.some((field) => field.key === 'condition') && <div><p className="mb-1.5 text-sm font-semibold text-ink-900">Product condition</p><div className="flex gap-2"><button type="button" onClick={() => setCondition('NEW')} className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold ${condition === 'NEW' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-outline text-ink-600'}`}>New</button><button type="button" onClick={() => setCondition('USED')} className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold ${condition === 'USED' ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-outline text-ink-600'}`}>Used</button></div></div>}</div>
            <aside className="h-fit rounded-lg border border-outline bg-bg p-4 lg:sticky lg:top-24"><p className="text-sm font-bold text-ink-900">Listing Summary</p><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-ink-500">Category</span><span className="text-right font-semibold text-ink-800">{selectedTemplate?.name_bn || 'Not selected'}</span></div><div className="flex justify-between gap-3"><span className="text-ink-500">Images</span><span className="font-semibold text-ink-800">{images.length}</span></div><div className="flex justify-between gap-3"><span className="text-ink-500">Price</span><span className="font-semibold text-ink-800">৳ {price || '0'}</span></div></div></aside>
          </div></section>}

          {step === 2 && <section className="mt-4 border-b border-outline bg-surface py-4 sm:py-5"><div className="mb-4"><h2 className="text-xl font-bold text-ink-900">পণ্যের বিস্তারিত তথ্য</h2><p className="mt-1 text-sm text-ink-500">আপনার নির্বাচিত category অনুযায়ী প্রয়োজনীয় তথ্য এখানে দেখানো হবে।</p></div>{selectedTemplate ? <><div className="border-l-2 border-brand-500 bg-brand-50/60 px-3 py-2"><p className="font-semibold text-ink-900">{selectedTemplate.name_bn}</p><p className="mt-1 text-sm text-ink-500">{selectedTemplate.description_bn || 'শুধু এই category-এর জন্য প্রাসঙ্গিক তথ্য পূরণ করুন।'}</p></div><div className="mt-4 grid gap-4 sm:grid-cols-2">{selectedTemplate.fields.filter((field) => field.key !== 'game_name').map(renderSpecField)}</div>{missingRequiredFields.length > 0 && <p className="mt-4 border-l-2 border-error bg-error/5 p-3 text-sm text-error">প্রয়োজনীয় তথ্য: {missingRequiredFields.map((field) => field.label_bn).join(', ')}</p>}</> : <p className="border-l-2 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">Step 1-এ একটি category নির্বাচন করুন।</p>}</section>}

          {step === 3 && <section className="mt-4 border-b border-outline bg-surface py-4 sm:py-5"><div className="mb-6"><h2 className="text-xl font-bold text-ink-900">ডেলিভারি ও স্টক</h2><p className="mt-1 text-sm text-ink-500">ক্রেতা কীভাবে পণ্যটি পাবেন এবং আপনার পণ্যের availability নির্ধারণ করুন।</p></div><div className="space-y-4"><div><h3 className="text-sm font-bold text-ink-900">Delivery Settings</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><BrandSelect label="Delivery method *" value={autoDeliveryEnabled ? 'AUTOMATIC' : 'MANUAL'} options={[{ value: 'AUTOMATIC', label: 'Automatic' }, { value: 'MANUAL', label: 'Manual' }, { value: 'BOTH', label: 'Automatic + Manual' }]} onChange={(value) => setAutoDeliveryEnabled(value !== 'MANUAL')} /><BrandSelect label="Delivery time *" value={autoDeliveryEnabled ? '0' : fulfillmentWindowMinutes} options={[{ value: '0', label: 'Instant' }, { value: '5', label: 'Within 5 minutes' }, { value: '30', label: 'Within 30 minutes' }, { value: '60', label: 'Within 1 hour' }, { value: 'CUSTOM', label: 'Custom' }]} onChange={(value) => setFulfillmentWindowMinutes(value === 'CUSTOM' ? '' : value)} /></div>{autoDeliveryEnabled && <p className="mt-2 text-xs text-brand-700">অটোমেটিক ডেলিভারি হলে ০ মিনিট নির্বাচন করা হবে।</p>}</div><div className="border-t border-outline pt-6"><h3 className="text-sm font-bold text-ink-900">Stock</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><BrandSelect label="Stock type" value={stockMode} options={[{ value: 'QUANTITY', label: 'Limited stock' }, { value: 'UNLIMITED', label: 'Unlimited' }, { value: 'KEY_POOL', label: 'Available on request / key pool' }]} onChange={(value) => setStockMode(value as 'UNLIMITED' | 'QUANTITY' | 'KEY_POOL')} />{stockMode === 'QUANTITY' && <label className="text-sm font-semibold text-ink-900">Stock quantity<input type="number" min="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} placeholder="10" className="mt-1.5 w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>}</div><button type="button" aria-pressed={deactivateWhenOutOfStock} onClick={() => setDeactivateWhenOutOfStock((value) => !value)} className={`mt-4 w-full rounded-lg border px-3 py-3 text-left text-sm ${deactivateWhenOutOfStock ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline text-ink-600'}`}>স্টক শেষ হলে পণ্যটি সক্রিয় রাখুন <span className="float-right font-bold">{deactivateWhenOutOfStock ? 'চালু' : 'বন্ধ'}</span></button><p className="mt-1 text-xs text-ink-500">চালু থাকলে স্টক ০ হলেও product listing ক্রেতাদের কাছে দেখা যাবে।</p></div><div className="border-t border-outline pt-6"><h3 className="text-sm font-bold text-ink-900">Product availability</h3><div className="mt-3 grid gap-4 sm:grid-cols-2"><BrandSelect label="Region / Country" value={regionCode} options={FIELD_OPTIONS.region_code.map((option) => ({ value: option, label: option }))} onChange={setRegionCode} placeholder="GLOBAL" /><BrandSelect label="Validity / Subscription" value={subscriptionPeriod} options={FIELD_OPTIONS.subscription_period.map((option) => ({ value: option, label: option }))} onChange={setSubscriptionPeriod} placeholder="মেয়াদ বেছে নিন" /><BrandSelect label="Warranty / Replacement" value={warrantyPeriod} options={FIELD_OPTIONS.warranty_period.map((option) => ({ value: option, label: option }))} onChange={setWarrantyPeriod} placeholder="Warranty বেছে নিন" /></div></div><div className="border-t border-outline pt-6"><h3 className="text-sm font-bold text-ink-900">{deliveryCopy.label}</h3><p className="mt-1 text-sm text-ink-500">অর্ডার সম্পন্ন হওয়ার পর ক্রেতা যে তথ্য পাবেন তা এখানে দিন।</p><textarea value={digitalDeliveryText} onChange={(event) => setDigitalDeliveryText(event.target.value)} rows={6} placeholder={deliveryCopy.placeholder} className="mt-3 w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><div className="mt-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2.5 text-xs leading-5 text-brand-800">এই তথ্য শুধুমাত্র অর্ডার সম্পন্ন হওয়ার পর সংশ্লিষ্ট ক্রেতাকে দেখানো হবে। Product description বা public image-এ কোনো গোপন তথ্য দেবেন না।</div></div><div><label className="text-sm font-semibold text-ink-900">ক্রেতার জন্য ডেলিভারি নির্দেশনা <span className="font-normal text-ink-400">— Optional</span><textarea value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} rows={4} placeholder="পেমেন্টের পরে কীভাবে পণ্যটি ব্যবহার, activate বা redeem করতে হবে তা লিখুন।" className="mt-1.5 w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label></div>{stockMode === 'KEY_POOL' && <div className="rounded-lg border border-outline bg-bg p-4"><p className="text-sm font-semibold text-ink-900">Key inventory: {availableKeyCount}</p>{isEditing ? <><textarea value={keyBatchText} onChange={(event) => setKeyBatchText(event.target.value)} rows={3} placeholder="প্রতি লাইনে একটি key" className="mt-3 w-full rounded-lg border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><button type="button" onClick={() => void handleAddLicenseKeys()} disabled={!keyBatchText.trim()} className="mt-2 rounded-lg border border-brand-500 px-3 py-2 text-sm font-semibold text-brand-700 disabled:opacity-50">Key যোগ করুন</button></> : <p className="mt-1 text-xs text-ink-500">লিস্টিং publish করার পর key inventory যোগ করা যাবে।</p>}</div>}</div></section>}

          {error && <p className="mt-4 rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><button type="button" onClick={() => step === 1 ? navigate('/my-listings') : goToStep(step - 1)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-outline px-4 py-3 text-sm font-semibold text-ink-700"><ChevronLeft size={17} />{step === 1 ? 'Cancel' : 'Back'}</button><div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={handleSaveDraft} className="rounded-lg border border-outline px-4 py-3 text-sm font-semibold text-ink-700">Save Draft</button>{step < 3 ? <button type="button" onClick={() => goToStep(step + 1)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-bold text-white">Continue <ChevronRight size={17} /></button> : <button type="button" onClick={() => { const validation = validateStep(3); if (validation) setError(validation); else { setError(null); setReviewing(true) } }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-bold text-white">Review Listing <ClipboardCheck size={17} /></button>}</div></div>
        </>}
      </div>
    </Layout>
  )
}
