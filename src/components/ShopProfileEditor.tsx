import { useEffect, useState } from 'react'
import { Camera, CheckCircle2, Image as ImageIcon, Save, Store, XCircle } from 'lucide-react'
import { uploadProductImages } from '@/lib/storage'
import { validateImageFiles } from '@/lib/fileValidation'
import { checkShopUsername, normalizeShopUsername, updateSellerShopProfile } from '@/lib/shopProfile'
import type { Profile } from '@/types/product'

type UsernameState = { status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'; suggestions: string[] }

export function ShopProfileEditor({ profile, onSaved }: { profile: Profile; onSaved: (profile: Profile) => void }) {
  const [shopName, setShopName] = useState(profile.shop_name ?? '')
  const [shopDescription, setShopDescription] = useState(profile.shop_description ?? '')
  const [shopUsername, setShopUsername] = useState(profile.shop_username ?? '')
  const [shopImageUrl, setShopImageUrl] = useState(profile.photo_url ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState(profile.shop_cover_url ?? '')
  const [shopImageFile, setShopImageFile] = useState<File | null>(null)
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState(profile.photo_url ?? '')
  const [coverPreview, setCoverPreview] = useState(profile.shop_cover_url ?? '')
  const [usernameState, setUsernameState] = useState<UsernameState>({ status: profile.shop_username ? 'checking' : 'idle', suggestions: [] })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setShopName(profile.shop_name ?? '')
    setShopDescription(profile.shop_description ?? '')
    setShopUsername(profile.shop_username ?? '')
    setShopImageUrl(profile.photo_url ?? '')
    setCoverImageUrl(profile.shop_cover_url ?? '')
    setImagePreview(profile.photo_url ?? '')
    setCoverPreview(profile.shop_cover_url ?? '')
    setShopImageFile(null)
    setCoverImageFile(null)
    setUsernameState({ status: profile.shop_username ? 'checking' : 'idle', suggestions: [] })
  }, [profile.id, profile.shop_name, profile.shop_description, profile.shop_username, profile.photo_url, profile.shop_cover_url])

  useEffect(() => {
    const normalized = normalizeShopUsername(shopUsername)
    if (normalized !== shopUsername) {
      setShopUsername(normalized)
      return
    }
    if (normalized.length < 3) {
      setUsernameState({ status: normalized ? 'invalid' : 'idle', suggestions: [] })
      return
    }
    setUsernameState((current) => ({ ...current, status: 'checking' }))
    let active = true
    const timer = window.setTimeout(() => {
      void checkShopUsername(normalized, profile.id).then((result) => {
        if (active) setUsernameState({ status: result.is_available ? 'available' : 'taken', suggestions: result.suggestions })
      }).catch(() => {
        if (active) setUsernameState({ status: 'invalid', suggestions: [] })
      })
    }, 350)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [profile.id, shopUsername])

  useEffect(() => {
    if (!imagePreview.startsWith('blob:')) return
    return () => URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  useEffect(() => {
    if (!coverPreview.startsWith('blob:')) return
    return () => URL.revokeObjectURL(coverPreview)
  }, [coverPreview])

  const handleImageChange = (file: File | null, type: 'profile' | 'cover') => {
    if (!file) return
    const validationError = validateImageFiles([file], 1)
    if (validationError) {
      setMessage({ tone: 'error', text: validationError })
      return
    }
    setMessage(null)
    if (type === 'profile') {
      setShopImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    } else {
      setCoverImageFile(file)
      setCoverPreview(URL.createObjectURL(file))
    }
  }

  const handleSave = async () => {
    const normalizedName = shopName.trim()
    const normalizedDescription = shopDescription.trim()
    const normalizedUsername = normalizeShopUsername(shopUsername)
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      setMessage({ tone: 'error', text: 'শপের নাম ২ থেকে ৮০ অক্ষরের মধ্যে দিন।' })
      return
    }
    if (normalizedDescription.length > 600) {
      setMessage({ tone: 'error', text: 'শপের বিবরণ সর্বোচ্চ ৬০০ অক্ষরের হতে পারবে।' })
      return
    }
    if (usernameState.status !== 'available' || normalizedUsername !== shopUsername) {
      setMessage({ tone: 'error', text: 'একটি available username নির্বাচন করুন।' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      let nextImageUrl = shopImageUrl
      let nextCoverUrl = coverImageUrl
      if (shopImageFile) {
        const [uploadedUrl] = await uploadProductImages([shopImageFile], `profile-photos/${profile.id}`)
        if (!uploadedUrl) throw new Error('প্রোফাইল ছবি আপলোড করা যায়নি।')
        nextImageUrl = uploadedUrl
      }
      if (coverImageFile) {
        const [uploadedUrl] = await uploadProductImages([coverImageFile], `profile-covers/${profile.id}`)
        if (!uploadedUrl) throw new Error('কভার ছবি আপলোড করা যায়নি।')
        nextCoverUrl = uploadedUrl
      }

      const saved = await updateSellerShopProfile({
        shopName: normalizedName,
        shopDescription: normalizedDescription,
        shopUsername: normalizedUsername,
        photoUrl: nextImageUrl || null,
        coverUrl: nextCoverUrl || null,
      })
      const nextProfile = { ...profile, ...(saved ?? {}), shop_name: normalizedName, shop_description: normalizedDescription, shop_username: normalizedUsername, photo_url: nextImageUrl || null, shop_cover_url: nextCoverUrl || null } as Profile
      onSaved(nextProfile)
      setShopImageUrl(nextImageUrl)
      setCoverImageUrl(nextCoverUrl)
      setShopImageFile(null)
      setCoverImageFile(null)
      setImagePreview(nextImageUrl)
      setCoverPreview(nextCoverUrl)
      setMessage({ tone: 'success', text: 'শপ প্রোফাইল আপডেট হয়েছে।' })
    } catch (error) {
      console.error('Shop profile save failed:', error)
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'শপ প্রোফাইল আপডেট করা যায়নি।' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6 border border-brand-100 bg-brand-50/50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-brand-500 text-white"><Store size={19} /></span>
        <div><h2 className="font-semibold text-ink-900">আপনার শপ প্রোফাইল</h2><p className="mt-1 text-xs leading-5 text-ink-600">ক্রেতারা আপনার শপে এই নাম, ছবি, কভার ও বিবরণ দেখতে পাবে।</p></div>
      </div>

      <div className="mt-4 overflow-hidden border border-brand-100 bg-white">
        <div className="relative h-32 overflow-hidden bg-gradient-to-r from-brand-800 via-brand-600 to-emerald-300 sm:h-40">
          {coverPreview ? <img src={coverPreview} alt="শপ কভার" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm font-semibold text-white/80">শপ কভার ছবি যোগ করুন</div>}
          <label className="absolute bottom-2 right-2 flex cursor-pointer items-center gap-1.5 bg-ink-900/75 px-3 py-2 text-xs font-semibold text-white transition hover:bg-ink-900"><Camera size={14} />কভার পরিবর্তন<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => handleImageChange(event.target.files?.[0] ?? null, 'cover')} /></label>
        </div>
        <div className="relative grid gap-4 p-4 sm:grid-cols-[132px_1fr] sm:p-5">
          <div className="relative -mt-12 flex h-28 w-28 items-center justify-center overflow-hidden border-4 border-white bg-brand-100 text-3xl font-bold text-brand-700 shadow-sm sm:-mt-14">
            {imagePreview ? <img src={imagePreview} alt="শপ প্রোফাইল" className="h-full w-full object-cover" /> : <ImageIcon size={34} />}
            <label className="absolute inset-x-1 bottom-1 flex cursor-pointer items-center justify-center gap-1 bg-ink-900/75 px-2 py-1.5 text-[11px] font-semibold text-white"><Camera size={12} />ছবি<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => handleImageChange(event.target.files?.[0] ?? null, 'profile')} /></label>
          </div>
          <div className="space-y-3">
            <label className="block"><span className="text-xs font-semibold text-ink-700">শপের নাম</span><input value={shopName} onChange={(event) => setShopName(event.target.value)} maxLength={80} placeholder="যেমন: Shavora Digital" className="mt-1 w-full border border-outline bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><span className="mt-1 block text-right text-[11px] text-ink-400">{shopName.length}/80</span></label>
            <label className="block"><span className="text-xs font-semibold text-ink-700">ইউনিক শপ username</span><input value={shopUsername} onChange={(event) => setShopUsername(normalizeShopUsername(event.target.value))} maxLength={40} placeholder="যেমন: shavora-digital" className="mt-1 w-full border border-outline bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><span className="mt-1 block text-xs text-ink-500">আপনার শপ লিংক: /seller/{shopUsername || 'your-shop'}</span></label>
            {usernameState.status === 'checking' && <p className="text-xs text-ink-500">username যাচাই হচ্ছে...</p>}
            {usernameState.status === 'available' && <p className="flex items-center gap-1 text-xs font-semibold text-brand-700"><CheckCircle2 size={15} />এই username available</p>}
            {usernameState.status === 'taken' && <p className="flex items-center gap-1 text-xs font-semibold text-error"><XCircle size={15} />এই username নেওয়া হয়েছে</p>}
            {usernameState.suggestions.length > 0 && <div className="flex flex-wrap gap-2"><span className="text-xs text-ink-500">প্রস্তাবিত:</span>{usernameState.suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setShopUsername(suggestion)} className="border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">{suggestion}</button>)}</div>}
            <label className="block"><span className="text-xs font-semibold text-ink-700">শপের বিবরণ</span><textarea value={shopDescription} onChange={(event) => setShopDescription(event.target.value)} maxLength={600} rows={4} placeholder="আপনার শপ, পণ্য বা সেবা সম্পর্কে সংক্ষিপ্ত বর্ণনা লিখুন।" className="mt-1 w-full resize-y border border-outline bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-brand-500" /><span className="mt-1 block text-right text-[11px] text-ink-400">{shopDescription.length}/600</span></label>
            {message && <p className={`px-3 py-2 text-xs leading-5 ${message.tone === 'success' ? 'bg-brand-100 text-brand-800' : 'bg-error/10 text-error'}`}>{message.text}</p>}
            <button type="button" onClick={handleSave} disabled={saving || usernameState.status === 'checking'} className="inline-flex items-center gap-2 bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"><Save size={15} />{saving ? 'সংরক্ষণ হচ্ছে...' : 'শপ প্রোফাইল সংরক্ষণ করুন'}</button>
          </div>
        </div>
      </div>
    </section>
  )
}
