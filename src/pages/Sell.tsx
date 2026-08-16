import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { ImageUploader } from '@/components/ImageUploader'
import { uploadProductImages } from '@/lib/storage'
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
  const { user } = useAuth()

  const [categories, setCategories] = useState<Category[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [originalPrice, setOriginalPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [condition, setCondition] = useState<'NEW' | 'USED'>('USED')
  const [location, setLocation] = useState('')
  const [images, setImages] = useState<LocalImage[]>([])
  const [loadingExisting, setLoadingExisting] = useState(isEditing)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (!id || !user) return

    supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: fetchError }) => {
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
        setLocation(data.location)
        setImages(data.images.map((url: string) => ({ url })))
        setLoadingExisting(false)
      })
  }, [id, user])

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
    } catch {
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
    location.trim().length >= 2 &&
    images.length > 0 &&
    !images.some((img) => img.uploading)

  const handleSubmit = async () => {
    if (!user || !isValid) return
    setSubmitting(true)
    setError(null)

    const payload = {
      title: title.trim(),
      description: description.trim(),
      price: Number(price),
      original_price: originalPrice ? Number(originalPrice) : null,
      category_id: categoryId,
      condition,
      location: location.trim(),
      images: images.map((img) => img.url),
      seller_id: user.uid,
    }

    const result = isEditing
      ? await supabase.from('products').update(payload).eq('id', id)
      : await supabase.from('products').insert(payload).select('id').single()

    setSubmitting(false)
    if (result.error) {
      setError('সেভ করা যায়নি — আবার চেষ্টা করুন।')
      return
    }

    navigate(isEditing ? `/products/${id}` : '/my-listings')
  }

  if (loadingExisting) {
    return (
      <Layout>
        <div className="h-96 animate-pulse rounded-2xl bg-outline/40" />
      </Layout>
    )
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold text-ink-900">{isEditing ? 'লিস্টিং এডিট করুন' : 'নতুন পণ্য বিক্রি করুন'}</h1>

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
          <label className="mb-1.5 block text-sm font-medium text-ink-900">এলাকা</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="যেমন: শাহ আলম, সেলাঙ্গর"
            className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

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
