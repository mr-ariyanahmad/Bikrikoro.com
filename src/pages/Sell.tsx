import { useEffect, useState } from 'react'
import { KeyRound, Link2, ShieldCheck } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { BrandSelect } from '@/components/BrandSelect'
import { ImageUploader } from '@/components/ImageUploader'
import { uploadProductImages } from '@/lib/storage'
import { clearListingDraft, loadListingDraft, saveListingDraft } from '@/lib/listingDrafts'
import type { DigitalCategoryTemplate, ProductDigitalSpecs } from '@/types/product'
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
  const payload = await response.json().catch(() => ({})) as { error?: string; productId?: string }
  if (!response.ok) throw new Error(payload.error || 'পণ্য সেভ করা যায়নি।')
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
  const [digitalVerified, setDigitalVerified] = useState(false)
  const [digitalVerificationLoading, setDigitalVerificationLoading] = useState(true)
  const [archivedPhysical, setArchivedPhysical] = useState(false)

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
      const { data, error: fetchError } = await supabase.rpc('seller_get_product', { p_seller_id: user.uid, p_product_id: id })
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
    setDraftMessage('ডিজিটাল লিস্টিং ড্রাফট সেভ হয়েছে।')
  }

  const handleClearDraft = () => {
    clearListingDraft()
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
    try {
      if (!digitalVerified) throw new Error('ডিজিটাল পণ্য বিক্রি করতে Seller Verification ও Admin approval প্রয়োজন।')
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
      setError(submitError instanceof Error ? `সেভ করা যায়নি — ${submitError.message}` : 'পণ্য সেভ করা যায়নি।')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingExisting || digitalVerificationLoading) {
    return <Layout wide><div className="mx-auto max-w-3xl animate-pulse border border-outline bg-surface p-8"><div className="h-6 w-48 bg-outline/50" /><div className="mt-4 h-32 bg-outline/30" /></div></Layout>
  }

  if (archivedPhysical) {
    return (
      <Layout wide>
        <div className="mx-auto max-w-xl border border-outline bg-surface p-6 text-center">
          <ShieldCheck className="mx-auto text-brand-600" size={32} />
          <h1 className="mt-3 text-lg font-bold text-ink-900">এই physical listing archive করা হয়েছে</h1>
          <p className="mt-2 text-sm leading-6 text-ink-600">BikriKoro এখন শুধু digital product marketplace। পুরনো রেকর্ড history ও admin audit-এর জন্য সংরক্ষিত আছে।</p>
        </div>
      </Layout>
    )
  }

  if (!digitalVerified) {
    return (
      <Layout wide>
        <div className="mx-auto max-w-xl border border-brand-200 bg-brand-50 p-6 text-center">
          <ShieldCheck className="mx-auto text-brand-600" size={34} />
          <h1 className="mt-3 text-lg font-bold text-ink-900">Digital Seller Verification প্রয়োজন</h1>
          <p className="mt-2 text-sm leading-6 text-ink-700">পণ্য প্রকাশের আগে আপনার seller identity ও ব্যবসায়িক তথ্য যাচাই করা প্রয়োজন।</p>
          <button type="button" onClick={() => navigate('/become-seller')} className="mt-5 bg-brand-500 px-4 py-3 text-base font-semibold text-white">Verification শুরু করুন</button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-700">ডিজিটাল মার্কেটপ্লেস</p>
          <h1 className="mt-1 text-xl font-semibold text-ink-900">{isEditing ? 'ডিজিটাল লিস্টিং এডিট করুন' : 'ডিজিটাল পণ্য বিক্রি করুন'}</h1>
        </div>
        {!isEditing && <div className="flex gap-2"><button type="button" onClick={handleSaveDraft} className="border border-outline px-3 py-2 text-base font-semibold text-ink-700 hover:border-brand-500 hover:text-brand-700">ড্রাফট সেভ</button><button type="button" onClick={handleClearDraft} className="border border-error/30 px-3 py-2 text-base font-semibold text-error hover:bg-error/5">ড্রাফট মুছুন</button></div>}
      </div>
      {draftMessage && <p className="mt-2 text-sm text-brand-700">{draftMessage}</p>}

      <div className="mt-6 space-y-5">
        <section className="border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-600" /><div><p className="text-sm font-semibold text-ink-900">প্রথমে ক্যাটাগরি বেছে নিন</p><p className="mt-1 text-xs leading-5 text-ink-700">সঠিক ক্যাটাগরি বেছে নিলে আপনার পণ্যের প্রয়োজনীয় তথ্যগুলো পরের ধাপে দেখা যাবে।</p></div></div>
          <div className="mt-4"><BrandSelect label="ডিজিটাল ক্যাটাগরি" value={categoryId} options={categoryTemplates.map((template) => ({ value: template.category_id, label: template.name_bn }))} onChange={(value) => { setCategoryId(value); setSpecifications({}) }} placeholder="ডিজিটাল ক্যাটাগরি বেছে নিন" disabled={categoryTemplates.length === 0} /></div>
          {!categoryId && <p className="mt-3 text-xs text-ink-500">ক্যাটাগরি নির্বাচন করার পর পণ্যের তথ্য পূরণ করার অংশ খুলবে।</p>}
        </section>
        {categoryId && <>
        <div className="border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-600" /><div><p className="text-sm font-semibold text-ink-900">নিরাপদ ডিজিটাল ডেলিভারি</p><p className="mt-1 text-xs leading-5 text-ink-700">অর্ডার সম্পন্ন হলে ক্রেতা তার অর্ডার পেজে key, file link বা ব্যবহারের নির্দেশনা দেখতে পারবেন।</p></div></div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">পণ্যের ছবি</label>
          <ImageUploader images={images} onAdd={handleAddImages} onRemove={handleRemoveImage} onError={setError} max={8} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">YouTube product video (ঐচ্ছিক)</label>
          <input type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className={`w-full border px-3 py-2.5 text-sm outline-none focus:border-brand-500 ${videoUrl && !isYouTubeUrl(videoUrl) ? 'border-error' : 'border-outline'}`} />
          <p className="mt-1.5 text-xs text-ink-500">YouTube link দিলে product page-এ video প্রথমে দেখাবে; swipe করলে ছবিগুলো দেখা যাবে।</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">পণ্যের নাম</label>
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="যেমন: Canva Pro 1 বছরের access" className="w-full border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">বিবরণ</label>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Digital product কী, কীভাবে ব্যবহার করবেন, মেয়াদ বা সীমাবদ্ধতা লিখুন" className="w-full border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="mb-1.5 block text-sm font-medium text-ink-900">দাম (৳)</label><input type="number" inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} className="tabular-amount w-full border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></div>
          <div><label className="mb-1.5 block text-sm font-medium text-ink-900">মূল দাম (ঐচ্ছিক)</label><input type="number" inputMode="numeric" value={originalPrice} onChange={(event) => setOriginalPrice(event.target.value)} placeholder="ছাড় দেখাতে চাইলে" className="tabular-amount w-full border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></div>
        </div>

        <div><label className="mb-1.5 block text-sm font-medium text-ink-900">অবস্থা</label><div className="flex border border-outline p-1">{(['NEW', 'USED'] as const).map((value) => <button key={value} type="button" onClick={() => setCondition(value)} className={`flex-1 py-2 text-base font-medium ${condition === value ? 'bg-brand-500 text-white' : 'text-ink-600'}`}>{value === 'NEW' ? 'নতুন' : 'ব্যবহৃত'}</button>)}</div></div>

        {selectedTemplate && <section className="border border-brand-200 bg-brand-50/40 p-4">
          <div className="flex items-start gap-3"><ShieldCheck size={19} className="mt-0.5 shrink-0 text-brand-600" /><div><p className="text-sm font-semibold text-ink-900">{selectedTemplate.name_bn} এর তথ্য</p><p className="mt-1 text-xs leading-5 text-ink-600">{selectedTemplate.description_bn || 'এই ক্যাটাগরির গুরুত্বপূর্ণ তথ্য পরিষ্কারভাবে দিন।'}</p></div></div>
          {selectedTemplate.fields.filter((field) => field.key !== 'game_name').length > 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{selectedTemplate.fields.filter((field) => field.key !== 'game_name').map((field) => {
            const rawValue = specifications[field.key]
            const value = typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean' ? rawValue : ''
            const setValue = (next: unknown) => setSpecifications((current) => ({ ...current, [field.key]: next }))
            if (field.type === 'select') return <BrandSelect key={field.key} label={`${field.label_bn}${field.required ? ' *' : ''}`} value={String(value)} options={(field.options ?? []).map((option) => ({ value: option, label: option }))} onChange={setValue} placeholder="বেছে নিন" />
            if (field.type === 'textarea') return <label key={field.key} className="text-sm text-ink-700 sm:col-span-2"><span className="mb-1.5 block font-medium text-ink-900">{field.label_bn}{field.required ? ' *' : ''}</span><textarea value={String(value)} onChange={(event) => setValue(event.target.value)} rows={3} className="w-full border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>
            if (field.type === 'number') return <label key={field.key} className="text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">{field.label_bn}{field.required ? ' *' : ''}</span><input type="number" value={value === '' ? '' : String(value)} onChange={(event) => setValue(event.target.value ? Number(event.target.value) : '')} className="w-full border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>
            if (field.type === 'boolean') return <button key={field.key} type="button" aria-pressed={value === true} onClick={() => setValue(value !== true)} className={`flex min-h-11 items-center justify-between border px-3 py-2.5 text-left text-sm ${value === true ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline bg-surface text-ink-600'}`}><span>{field.label_bn}{field.required ? ' *' : ''}</span><span className="text-xs font-semibold">{value === true ? 'হ্যাঁ' : 'না'}</span></button>
            return <label key={field.key} className="text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">{field.label_bn}{field.required ? ' *' : ''}</span><input type="text" value={String(value)} onChange={(event) => setValue(event.target.value)} className="w-full border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>
          })}</div> : <p className="mt-3 text-xs text-ink-500">এই ক্যাটাগরির অতিরিক্ত তথ্য এখনো যোগ করা হয়নি।</p>}
          {missingRequiredFields.length > 0 && <p className="mt-3 border border-warning/30 bg-warning/5 p-2.5 text-xs text-warning">এই তথ্যগুলো পূরণ করুন: {missingRequiredFields.map((field) => field.label_bn).join(', ')}</p>}
        </section>}

        <section className="border border-outline bg-surface p-4">
          <div className="flex items-start gap-3"><KeyRound size={19} className="mt-0.5 shrink-0 text-brand-600" /><div><p className="text-sm font-semibold text-ink-900">ডেলিভারি, মজুত ও পণ্যের শর্ত</p><p className="mt-1 text-xs leading-5 text-ink-600">অঞ্চল, মেয়াদ, warranty, মজুত এবং ডেলিভারির সময় সম্পর্কে পরিষ্কার তথ্য দিন।</p></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <BrandSelect label="ডেলিভারি পদ্ধতি" value={digitalDeliveryType} options={[{ value: 'INSTRUCTIONS', label: 'ব্যবহারের নির্দেশনা' }, { value: 'LICENSE_KEY', label: 'লাইসেন্স / এক্টিভেশন কী' }, { value: 'DOWNLOAD_LINK', label: 'ডাউনলোড লিংক' }]} onChange={(value) => setDigitalDeliveryType(value as DigitalContent['delivery_type'])} />
            <BrandSelect label="মজুতের ধরন" value={stockMode} options={[{ value: 'UNLIMITED', label: 'সীমাহীন / নির্দেশনা অনুযায়ী' }, { value: 'QUANTITY', label: 'নির্দিষ্ট পরিমাণ' }, { value: 'KEY_POOL', label: 'আলাদা key-এর তালিকা' }]} onChange={(value) => setStockMode(value as 'UNLIMITED' | 'QUANTITY' | 'KEY_POOL')} />
            <label className="text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">অঞ্চল কোড</span><input value={regionCode} onChange={(event) => setRegionCode(event.target.value.toUpperCase())} placeholder="GLOBAL বা BD" className="w-full border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>
            <label className="text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">মেয়াদ / সাবস্ক্রিপশন</span><input value={subscriptionPeriod} onChange={(event) => setSubscriptionPeriod(event.target.value)} placeholder="যেমন: ৩০ দিন / Lifetime" className="w-full border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>
            <label className="text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">ওয়ারেন্টি / পরিবর্তনের সময়</span><input value={warrantyPeriod} onChange={(event) => setWarrantyPeriod(event.target.value)} placeholder="যেমন: ৭ দিন বা নেই" className="w-full border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>
            <label className="text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">ডেলিভারির সর্বোচ্চ সময় (মিনিট)</span><input type="number" min="0" value={fulfillmentWindowMinutes} onChange={(event) => setFulfillmentWindowMinutes(event.target.value)} placeholder="অটোমেটিক ডেলিভারি হলে ০" className="w-full border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>
            {stockMode === 'QUANTITY' && <label className="text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">মজুতের পরিমাণ</span><input type="number" min="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} className="w-full border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" aria-pressed={autoDeliveryEnabled} onClick={() => setAutoDeliveryEnabled((value) => !value)} className={`border px-3 py-2.5 text-left text-sm ${autoDeliveryEnabled ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline text-ink-600'}`}>অটোমেটিক ডেলিভারি: <strong>{autoDeliveryEnabled ? 'চালু' : 'বন্ধ'}</strong></button><button type="button" aria-pressed={deactivateWhenOutOfStock} onClick={() => setDeactivateWhenOutOfStock((value) => !value)} className={`border px-3 py-2.5 text-left text-sm ${deactivateWhenOutOfStock ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline text-ink-600'}`}>মজুত শেষ হলে পণ্য: <strong>{deactivateWhenOutOfStock ? 'অপ্রকাশিত হবে' : 'চালু থাকবে'}</strong></button></div>
          {stockMode === 'KEY_POOL' && <div className="mt-4 border border-brand-200 bg-brand-50/50 p-3"><p className="text-xs font-semibold text-brand-700">মজুত key: {availableKeyCount}</p><p className="mt-1 text-xs text-ink-600">প্রতি লাইনে একটি করে key লিখুন। এগুলো প্রকাশ্য পণ্যের পাতায় দেখা যাবে না।</p>{isEditing ? <><textarea value={keyBatchText} onChange={(event) => setKeyBatchText(event.target.value)} rows={4} placeholder="KEY-001\nKEY-002\nKEY-003" className="mt-3 w-full border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><button type="button" onClick={() => void handleAddLicenseKeys()} disabled={!keyBatchText.trim()} className="mt-2 border border-brand-500 px-3 py-2 text-base font-semibold text-brand-700 disabled:opacity-50">Key যোগ করুন</button></> : <p className="mt-2 text-xs text-ink-600">পণ্যটি একবার সেভ করার পর এখানে key যোগ করা যাবে।</p>}</div>}
          <label className="mt-4 block text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">ক্রেতার জন্য ডেলিভারি নোট / নির্দেশনা (ঐচ্ছিক)</span><textarea value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} rows={3} placeholder="পেমেন্টের পরে কীভাবে ব্যবহার বা redeem করবে তা লিখুন।" className="w-full border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label>
        </section>

        <div className="border border-brand-200 bg-brand-50/60 p-4">
          <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-brand-700">{digitalDeliveryType === 'LICENSE_KEY' ? <KeyRound size={16} /> : digitalDeliveryType === 'DOWNLOAD_LINK' ? <Link2 size={16} /> : <ShieldCheck size={16} />} অর্ডার সম্পন্ন হলে ক্রেতা কী পাবেন তা লিখুন</div>
          <textarea value={digitalDeliveryText} onChange={(event) => setDigitalDeliveryText(event.target.value)} rows={5} placeholder="গোপন key, ব্যবহারের নির্দেশনা অথবা নিরাপদ download link লিখুন। প্রকাশ্য ছবি বা link এখানে দেবেন না।" className="mt-3 w-full border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
          <p className="mt-2 text-xs leading-relaxed text-ink-600">এই তথ্য কেবল অর্ডার সম্পন্ন হওয়ার পর সংশ্লিষ্ট ক্রেতাকে নিরাপদে দেখানো হবে।</p>
        </div>

        {error && <p className="border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>}

        <button type="button" onClick={() => void handleSubmit()} disabled={!isValid || submitting} className="w-full bg-brand-500 py-3 text-base font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'সেভ করা হচ্ছে...' : isEditing ? 'পরিবর্তন সেভ করুন' : 'ডিজিটাল লিস্টিং পাঠান'}</button>
        </>}
      </div>
    </Layout>
  )
}
