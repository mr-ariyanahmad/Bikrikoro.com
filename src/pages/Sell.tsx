import { useEffect, useState } from 'react'
import { FileCheck2, Package, ShieldCheck } from 'lucide-react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { ImageUploader } from '@/components/ImageUploader'
import { uploadProductImages } from '@/lib/storage'
import { clearListingDraft, loadListingDraft, saveListingDraft } from '@/lib/listingDrafts'
import type { Category } from '@/types/product'

interface LocalImage {
  url: string
  file?: File
  uploading?: boolean
}

export default function Sell() {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const requestedMode = searchParams.get('mode')
  const modeLocked = requestedMode === 'DIGITAL' || requestedMode === 'PHYSICAL'

  const [categories, setCategories] = useState<Category[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [condition, setCondition] = useState<'NEW' | 'USED'>('USED')
  const [isDigital, setIsDigital] = useState(requestedMode === 'DIGITAL')
  const [modeSelected, setModeSelected] = useState(isEditing || modeLocked)
  const [supportsCod, setSupportsCod] = useState(false)
  const [freeDelivery, setFreeDelivery] = useState(false)
  const [fastDelivery, setFastDelivery] = useState(false)
  const [freeReturn, setFreeReturn] = useState(false)
  const [digitalDeliveryType, setDigitalDeliveryType] = useState<'INSTRUCTIONS' | 'LICENSE_KEY' | 'DOWNLOAD_LINK'>('INSTRUCTIONS')
  const [digitalDeliveryText, setDigitalDeliveryText] = useState('')
  const [location, setLocation] = useState('')
  const [images, setImages] = useState<LocalImage[]>([])
  const [loadingExisting, setLoadingExisting] = useState(isEditing)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftMessage, setDraftMessage] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        setCategories(data ?? [])
        if (data && data.length > 0 && !categoryId) setCategoryId(data[0].id)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isEditing) return
    const draft = loadListingDraft()
    if (!draft) return
    setTitle(draft.title)
    setDescription(draft.description)
    setPrice(draft.price)
    setOriginalPrice(draft.originalPrice)
    setCategoryId(draft.categoryId)
    setCondition(draft.condition)
    if (!modeLocked) setIsDigital(draft.isDigital)
    setSupportsCod(draft.supportsCod)
    setFreeDelivery(draft.freeDelivery)
    setFastDelivery(draft.fastDelivery)
    setFreeReturn(draft.freeReturn)
    setDigitalDeliveryType(draft.digitalDeliveryType)
    setDigitalDeliveryText(draft.digitalDeliveryText)
    setLocation(draft.location)
    setImages(draft.images.map((url) => ({ url })))
    setModeSelected(true)
    setDraftMessage('আগের অসম্পূর্ণ ড্রাফট লোড হয়েছে।')
  }, [isEditing, modeLocked])

  useEffect(() => {
    if (!id || !user) return

    supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
      .then(async ({ data, error: fetchError }) => {
        if (fetchError || !data || data.seller_id !== user.uid) {
          setError('এই লিস্টিং খুঁজে পাওয়া যায়নি বা এটি আপনার নয়।')
          setLoadingExisting(false)
          return
        }
        setTitle(data.title)
        setDescription(data.description)
        setPrice(String(data.price))
        setOriginalPrice(data.original_price ? String(data.original_price) : '')
        setCategoryId(data.category_id)
        setCondition(data.condition)
        setIsDigital(Boolean(data.is_digital))
        setSupportsCod(Boolean(data.supports_cod))
        setFreeDelivery(Boolean(data.free_delivery))
        setFastDelivery(Boolean(data.fast_delivery))
        setFreeReturn(Boolean(data.free_return))
        setLocation(data.location || '')
        setImages(data.images.map((url: string) => ({ url })))
        const { data: delivery } = await supabase
          .from('digital_product_contents')
          .select('delivery_type, delivery_text')
          .eq('product_id', id)
          .maybeSingle()
        if (delivery) {
          setDigitalDeliveryType(delivery.delivery_type)
          setDigitalDeliveryText(delivery.delivery_text || '')
        }
        setLoadingExisting(false)
      })
  }, [id, user])

  const handleSaveDraft = () => {
    saveListingDraft({
      title,
      description,
      price,
      originalPrice,
      categoryId,
      condition,
      isDigital,
      supportsCod,
      freeDelivery,
      fastDelivery,
      freeReturn,
      digitalDeliveryType,
      digitalDeliveryText,
      location,
      images: images.filter((image) => !image.uploading).map((image) => image.url),
    })
    setDraftMessage('ড্রাফট সেভ হয়েছে। পরে আবার এলে এখান থেকেই শুরু করতে পারবেন।')
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
      setImages((prev) => {
        const next = [...prev]
        // replace the trailing placeholders (in order) with their uploaded URLs
        let uploadedIndex = 0
        for (let i = next.length - placeholders.length; i < next.length; i++) {
          next[i] = { url: urls[uploadedIndex] }
          uploadedIndex++
        }
        return next
      })
    } catch (err) {
      console.error('Image upload failed:', err)
      setError('ছবি আপলোড করা যায়নি — আবার চেষ্টা করুন।')
      setImages((prev) => prev.filter((img) => !placeholders.some((p) => p.url === img.url)))
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const isValid =
    title.trim().length >= 5 &&
    Number(price) > 0 &&
    categoryId &&
    (isDigital || location.trim().length >= 2) &&
    (!isDigital || digitalDeliveryText.trim().length >= 3) &&
    images.length > 0 &&
    !images.some((img) => img.uploading)
  const qualityChecks = [title.trim().length >= 10, description.trim().length >= 40, images.length >= 2, Number(price) > 0, isDigital || location.trim().length >= 2]
  const qualityScore = Math.round((qualityChecks.filter(Boolean).length / qualityChecks.length) * 100)

  const handleSubmit = async () => {
    if (!user || !isValid) return
    setSubmitting(true)
    setError(null)

    if (isDigital) {
      const { data: verification } = await supabase.from('seller_registrations').select('id').eq('user_id', user.uid).eq('listing_mode', 'DIGITAL').eq('status', 'APPROVED').maybeSingle()
      if (!verification) { setError('ডিজিটাল পণ্য বিক্রি করতে আগে Seller Verification সম্পন্ন ও Admin approval নিতে হবে।'); setSubmitting(false); return }
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      original_price: originalPrice ? Number(originalPrice) : null,
      category_id: categoryId,
      condition,
      is_digital:       isDigital,
      supports_cod: !isDigital && supportsCod,
      free_delivery: !isDigital && freeDelivery,
      fast_delivery: !isDigital && fastDelivery,
      free_return: !isDigital && freeReturn,
      location: isDigital ? '' : location.trim(),
      images: images.map((img) => img.url),
      seller_id: user.uid,
    }

    const result = isEditing
      ? await supabase.from('products').update(payload).eq('id', id)
      : await supabase.from('products').insert(payload).select('id').single()

    const savedProductId = id ?? result.data?.id
    if (!result.error && savedProductId) {
      const deliveryResult = isDigital
        ? await supabase.from('digital_product_contents').upsert({
            product_id: savedProductId,
            seller_id: user.uid,
            delivery_type: digitalDeliveryType,
            delivery_text: digitalDeliveryText.trim(),
          })
        : await supabase.from('digital_product_contents').delete().eq('product_id', savedProductId)
      if (deliveryResult.error && isDigital) {
        console.error('Digital delivery details could not be saved:', deliveryResult.error)
        setError('পণ্য সেভ হয়েছে, কিন্তু ডিজিটাল ডেলিভারি তথ্য সেভ হয়নি। migration প্রয়োগ করা হয়েছে কি না দেখুন।')
        setSubmitting(false)
        return
      }
    }

    setSubmitting(false)
    if (result.error) {
      console.error('Product save failed:', result.error)
      setError(`সেভ করা যায়নি — ${result.error.message}`)
      return
    }

    clearListingDraft()
    navigate(isEditing ? `/products/${id}` : '/my-listings')
  }

  if (loadingExisting) {
    return (
      <Layout>
        <div className="h-96 animate-pulse rounded-2xl bg-outline/40" />
      </Layout>
    )
  }

  if (!isEditing && !modeSelected) {
    return <Layout wide><div className="mx-auto max-w-3xl"><div className="rounded-3xl bg-ink-900 p-6 text-white sm:p-8"><p className="text-sm font-semibold text-brand-300">Seller setup</p><h1 className="mt-2 text-2xl font-bold">আপনি কী বিক্রি করবেন?</h1><p className="mt-2 text-sm leading-6 text-white/70">প্রথমে listing-এর ধরন নির্বাচন করুন। Digital product seller হলে publish করার আগে শক্ত verification লাগবে।</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={() => navigate('/become-seller/verify?mode=DIGITAL')} className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-left transition hover:border-brand-500"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white"><FileCheck2 size={22} /></span><span><span className="block text-lg font-bold text-ink-900">ডিজিটাল</span><span className="mt-1 block text-xs text-ink-500">কোড, ফাইল, course, service বা software</span></span></div><p className="mt-4 text-sm font-semibold text-brand-700">আগে verification করুন →</p></button><button onClick={() => { setIsDigital(false); setModeSelected(true) }} className="rounded-2xl border border-outline bg-surface p-5 text-left transition hover:border-brand-500"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg text-brand-600"><Package size={22} /></span><span><span className="block text-lg font-bold text-ink-900">ফিজিক্যাল</span><span className="mt-1 block text-xs text-ink-500">Courier-এ পাঠানো যাবে এমন পণ্য</span></span></div><p className="mt-4 text-sm font-semibold text-ink-600">Listing form-এ যান →</p></button></div><div className="mt-5 flex items-start gap-2 rounded-xl bg-brand-50 p-3 text-xs leading-5 text-brand-800"><ShieldCheck size={16} className="mt-0.5 shrink-0" />Admin approval, document verification এবং sector badge ক্রেতার trust বাড়াতে সাহায্য করবে।</div></div></Layout>
  }

  return (
    <Layout wide>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-900">{isEditing ? 'লিস্টিং এডিট করুন' : 'নতুন পণ্য বিক্রি করুন'}</h1>
        {!isEditing && (
          <div className="flex gap-2">
            <button onClick={handleSaveDraft} className="rounded-lg border border-outline px-3 py-2 text-xs font-semibold text-ink-600 hover:border-brand-500 hover:text-brand-600">
              ড্রাফট সেভ করুন
            </button>
            <button onClick={handleClearDraft} className="rounded-lg px-3 py-2 text-xs font-medium text-error hover:bg-error/5">
              ড্রাফট মুছুন
            </button>
          </div>
        )}
      </div>
      {draftMessage && <p className="mt-2 text-sm text-brand-700">{draftMessage}</p>}

      <div className="mt-6 space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">ছবি</label>
          <ImageUploader images={images} onAdd={handleAddImages} onRemove={handleRemoveImage} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">পণ্যের নাম</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="যেমন: স্যামসাং গ্যালাক্সি A54, প্রায় নতুন"
            className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">বিবরণ</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="পণ্যের অবস্থা, ব্যবহারের সময়কাল, কেন বিক্রি করছেন ইত্যাদি লিখুন"
            className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">দাম (৳)</label>
            <input
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="tabular-amount w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">আসল দাম (ঐচ্ছিক)</label>
            <input
              type="number"
              inputMode="numeric"
              value={originalPrice}
              onChange={(e) => setOriginalPrice(e.target.value)}
              placeholder="ছাড় দেখাতে চাইলে"
              className="tabular-amount w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">ক্যাটাগরি</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">অবস্থা</label>
            <div className="flex rounded-lg border border-outline p-1">
              {(['NEW', 'USED'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
                    condition === c ? 'bg-brand-500 text-white' : 'text-ink-600'
                  }`}
                >
                  {c === 'NEW' ? 'নতুন' : 'ব্যবহৃত'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-900"><input type="checkbox" checked={isDigital} onChange={(e) => setIsDigital(e.target.checked)} className="h-4 w-4 rounded border-outline text-brand-500 focus:ring-brand-500" />এটি একটি ডিজিটাল পণ্য (কোড/ফাইল/সার্ভিস — কুরিয়ারে পাঠানো হবে না)</label>
          <p className="mt-1 text-xs text-ink-300">ডিজিটাল পণ্যে ডেলিভারি ঠিকানা বা এলাকা লাগবে না, এবং কোনো ক্যাশ অন ডেলিভারি হয় না — আগে থেকে পেমেন্ট করে অর্ডার করতে হবে।</p>
        </div>

        {!isDigital && <div className="rounded-xl border border-outline bg-bg p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-ink-900">ক্রেতার জন্য ডেলিভারি ব্যাজ</p><p className="mt-1 text-xs text-ink-500">শুধু আপনি সত্যিই দিতে পারবেন এমন সুবিধা বেছে নিন।</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${qualityScore >= 80 ? 'bg-success/10 text-success' : 'bg-amber-50 text-amber-700'}`}>Listing quality {qualityScore}%</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{[[supportsCod, setSupportsCod, 'ক্যাশ অন ডেলিভারি (COD)'], [freeDelivery, setFreeDelivery, 'ফ্রি ডেলিভারি'], [fastDelivery, setFastDelivery, 'দ্রুত ডেলিভারি'], [freeReturn, setFreeReturn, 'ফ্রি রিটার্ন']].map(([checked, setter, label]) => <label key={label as string} className="flex items-center gap-2 rounded-lg border border-outline bg-surface px-3 py-2 text-sm text-ink-700"><input type="checkbox" checked={checked as boolean} onChange={(e) => (setter as (value: boolean) => void)(e.target.checked)} className="h-4 w-4 rounded border-outline text-brand-500 focus:ring-brand-500" />{label as string}</label>)}</div></div>}

        {isDigital && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
            <label className="mb-1.5 block text-sm font-medium text-ink-900">ডিজিটাল ডেলিভারি</label>
            <select
              value={digitalDeliveryType}
              onChange={(e) => setDigitalDeliveryType(e.target.value as typeof digitalDeliveryType)}
              className="w-full rounded-lg border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            >
              <option value="INSTRUCTIONS">ব্যবহারের নির্দেশনা</option>
              <option value="LICENSE_KEY">লাইসেন্স / এক্টিভেশন কী</option>
              <option value="DOWNLOAD_LINK">ডাউনলোড লিংক</option>
            </select>
            <textarea
              value={digitalDeliveryText}
              onChange={(e) => setDigitalDeliveryText(e.target.value)}
              rows={4}
              placeholder="পেমেন্ট সম্পন্ন হলে ক্রেতা কী পাবে তা লিখুন। পাবলিক ছবি লিংক এখানে দেবেন না।"
              className="mt-3 w-full rounded-lg border border-outline bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
            <p className="mt-2 text-xs leading-relaxed text-ink-600">ডেলিভারি তথ্য শুধু সম্পন্ন অর্ডারের ক্রেতার লাইব্রেরিতে দেখানো হবে।</p>
          </div>
        )}

        {!isDigital && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">এলাকা</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="যেমন: খুলনা সদর, খুলনা"
              className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'সেভ করা হচ্ছে...' : isEditing ? 'পরিবর্তন সেভ করুন' : 'পোস্ট করুন'}
        </button>
      </div>
    </Layout>
  )
}
