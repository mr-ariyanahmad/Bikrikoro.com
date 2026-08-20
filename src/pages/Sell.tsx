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
import type { Category } from '@/types/product'
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

export default function Sell() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
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
  const [loadingExisting, setLoadingExisting] = useState(isEditing)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftMessage, setDraftMessage] = useState<string | null>(null)
  const [digitalVerified, setDigitalVerified] = useState(false)
  const [digitalVerificationLoading, setDigitalVerificationLoading] = useState(true)
  const [archivedPhysical, setArchivedPhysical] = useState(false)

  useEffect(() => {
    let active = true
    supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        if (!active) return
        setCategories(data ?? [])
        if (data && data.length > 0) setCategoryId((current) => current || data[0].id)
      })
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
        const payload = await digitalContentRequest({ action: 'get', productId: id })
        const delivery = payload.content
        if (delivery) {
          setDigitalDeliveryType(delivery.delivery_type)
          setDigitalDeliveryText(delivery.delivery_text || '')
        }
      } catch (contentError) {
        console.error('Digital delivery content load failed:', contentError)
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

  const isValid =
    digitalVerified &&
    title.trim().length >= 5 &&
    Number(price) > 0 &&
    Boolean(categoryId) &&
    digitalDeliveryText.trim().length >= 3 &&
    images.length > 0 &&
    !images.some((image) => image.uploading) &&
    (!videoUrl.trim() || isYouTubeUrl(videoUrl))

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

      const result = isEditing
        ? await supabase.rpc('seller_update_product', {
            p_seller_id: user.uid,
            p_product_id: id,
            p_title: payload.title,
            p_description: payload.description,
            p_price: payload.price,
            p_original_price: payload.original_price,
            p_category_id: payload.category_id,
            p_condition: payload.condition,
            p_location: '',
            p_images: payload.images,
            p_is_digital: true,
            p_supports_cod: false,
            p_free_delivery: false,
            p_fast_delivery: false,
            p_free_return: false,
            p_video_url: payload.video_url,
          })
        : await supabase.rpc('seller_create_product', {
            p_seller_id: user.uid,
            p_title: payload.title,
            p_description: payload.description,
            p_price: payload.price,
            p_original_price: payload.original_price,
            p_category_id: payload.category_id,
            p_condition: payload.condition,
            p_location: '',
            p_images: payload.images,
            p_is_digital: true,
            p_supports_cod: false,
            p_free_delivery: false,
            p_fast_delivery: false,
            p_free_return: false,
            p_video_url: payload.video_url,
          })
      if (result.error) throw result.error

      const savedProductId = id ?? result.data
      if (!savedProductId) throw new Error('সেভ হওয়া পণ্যের ID পাওয়া যায়নি।')
      await digitalContentRequest({
        action: 'save',
        productId: savedProductId,
        deliveryType: digitalDeliveryType,
        deliveryText: digitalDeliveryText.trim(),
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
          <button type="button" onClick={() => navigate('/my-listings')} className="mt-5 bg-brand-500 px-4 py-3 text-base font-semibold text-white">My Listings-এ ফিরুন</button>
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
          <p className="mt-2 text-sm leading-6 text-ink-700">নিরাপদ digital marketplace-এ listing প্রকাশের আগে seller identity ও business information admin review করে approve করবেন।</p>
          <button type="button" onClick={() => navigate('/become-seller')} className="mt-5 bg-brand-500 px-4 py-3 text-base font-semibold text-white">Verification শুরু করুন</button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-700">Digital marketplace</p>
          <h1 className="mt-1 text-xl font-semibold text-ink-900">{isEditing ? 'ডিজিটাল লিস্টিং এডিট করুন' : 'ডিজিটাল পণ্য বিক্রি করুন'}</h1>
        </div>
        {!isEditing && <div className="flex gap-2"><button type="button" onClick={handleSaveDraft} className="border border-outline px-3 py-2 text-base font-semibold text-ink-700 hover:border-brand-500 hover:text-brand-700">ড্রাফট সেভ</button><button type="button" onClick={handleClearDraft} className="border border-error/30 px-3 py-2 text-base font-semibold text-error hover:bg-error/5">ড্রাফট মুছুন</button></div>}
      </div>
      {draftMessage && <p className="mt-2 text-sm text-brand-700">{draftMessage}</p>}

      <div className="mt-6 space-y-5">
        <div className="border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-start gap-3"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-600" /><div><p className="text-sm font-semibold text-ink-900">শুধু অনুমোদিত digital delivery</p><p className="mt-1 text-xs leading-5 text-ink-700">Payment escrow-এ গেলে buyer তার order library-তে key, file link বা instructions পাবে। Product approval আলাদা admin review-এর পরে হবে।</p></div></div>
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

        <div className="grid grid-cols-2 gap-3">
          <BrandSelect label="ক্যাটাগরি" value={categoryId} options={categories.map((category) => ({ value: category.id, label: category.name }))} onChange={setCategoryId} placeholder="ক্যাটাগরি বেছে নিন" disabled={categories.length === 0} />
          <div><label className="mb-1.5 block text-sm font-medium text-ink-900">অবস্থা</label><div className="flex border border-outline p-1">{(['NEW', 'USED'] as const).map((value) => <button key={value} type="button" onClick={() => setCondition(value)} className={`flex-1 py-2 text-base font-medium ${condition === value ? 'bg-brand-500 text-white' : 'text-ink-600'}`}>{value === 'NEW' ? 'নতুন' : 'ব্যবহৃত'}</button>)}</div></div>
        </div>

        <div className="border border-brand-200 bg-brand-50/60 p-4">
          <BrandSelect label="ডিজিটাল ডেলিভারি" value={digitalDeliveryType} options={[{ value: 'INSTRUCTIONS', label: 'ব্যবহারের নির্দেশনা' }, { value: 'LICENSE_KEY', label: 'লাইসেন্স / এক্টিভেশন কী' }, { value: 'DOWNLOAD_LINK', label: 'ডাউনলোড লিংক' }]} onChange={(value) => setDigitalDeliveryType(value as DigitalContent['delivery_type'])} />
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-brand-700">{digitalDeliveryType === 'LICENSE_KEY' ? <KeyRound size={16} /> : digitalDeliveryType === 'DOWNLOAD_LINK' ? <Link2 size={16} /> : <ShieldCheck size={16} />} Payment সফল হলে buyer কী পাবে তা লিখুন</div>
          <textarea value={digitalDeliveryText} onChange={(event) => setDigitalDeliveryText(event.target.value)} rows={5} placeholder="গোপন key, access instructions অথবা নিরাপদ download link লিখুন। পাবলিক ছবি URL এখানে দেবেন না।" className="mt-3 w-full border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
          <p className="mt-2 text-xs leading-relaxed text-ink-600">এই তথ্য শুধু সংশ্লিষ্ট buyer ও seller-এর authenticated order view-তে দেখানো হবে।</p>
        </div>

        {error && <p className="border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>}

        <button type="button" onClick={() => void handleSubmit()} disabled={!isValid || submitting} className="w-full bg-brand-500 py-3 text-base font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'সেভ করা হচ্ছে...' : isEditing ? 'পরিবর্তন সেভ করুন' : 'ডিজিটাল লিস্টিং পাঠান'}</button>
      </div>
    </Layout>
  )
}
