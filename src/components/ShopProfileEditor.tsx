import { useEffect, useState } from 'react'
import { Camera, Image as ImageIcon, Save, Store } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { uploadProductImages } from '@/lib/storage'
import { validateImageFiles } from '@/lib/fileValidation'
import type { Profile } from '@/types/product'

export function ShopProfileEditor({ profile, onSaved }: { profile: Profile; onSaved: (profile: Profile) => void }) {
  const [shopName, setShopName] = useState(profile.shop_name ?? '')
  const [shopDescription, setShopDescription] = useState(profile.shop_description ?? '')
  const [shopImageUrl, setShopImageUrl] = useState(profile.photo_url ?? '')
  const [shopImageFile, setShopImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState(profile.photo_url ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setShopName(profile.shop_name ?? '')
    setShopDescription(profile.shop_description ?? '')
    setShopImageUrl(profile.photo_url ?? '')
    setImagePreview(profile.photo_url ?? '')
    setShopImageFile(null)
  }, [profile.id, profile.shop_name, profile.shop_description, profile.photo_url])

  useEffect(() => {
    if (!imagePreview.startsWith('blob:')) return
    return () => URL.revokeObjectURL(imagePreview)
  }, [imagePreview])

  const handleImageChange = (file: File | null) => {
    if (!file) return
    const validationError = validateImageFiles([file], 1)
    if (validationError) {
      setMessage({ tone: 'error', text: validationError })
      return
    }
    setMessage(null)
    setShopImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSave = async () => {
    const normalizedName = shopName.trim()
    const normalizedDescription = shopDescription.trim()
    if (normalizedName.length < 2 || normalizedName.length > 80) {
      setMessage({ tone: 'error', text: 'Shop name ২ থেকে ৮০ অক্ষরের মধ্যে দিন।' })
      return
    }
    if (normalizedDescription.length > 600) {
      setMessage({ tone: 'error', text: 'Shop description সর্বোচ্চ ৬০০ অক্ষরের হতে পারবে।' })
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      let nextImageUrl = shopImageUrl
      if (shopImageFile) {
        const [uploadedUrl] = await uploadProductImages([shopImageFile], `profile-photos/${profile.id}`)
        if (!uploadedUrl) throw new Error('Shop image upload করা যায়নি।')
        nextImageUrl = uploadedUrl
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ shop_name: normalizedName, shop_description: normalizedDescription, photo_url: nextImageUrl || null })
        .eq('id', profile.id)
        .select('*')
        .single()
      if (error) throw error

      onSaved(data as Profile)
      setShopImageUrl(nextImageUrl)
      setShopImageFile(null)
      setImagePreview(nextImageUrl)
      setMessage({ tone: 'success', text: 'Shop profile আপডেট হয়েছে।' })
    } catch (error) {
      console.error('Shop profile save failed:', error)
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Shop profile আপডেট করা যায়নি।' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-brand-100 bg-brand-50/50 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white"><Store size={19} /></span>
        <div><h2 className="font-semibold text-ink-900">আপনার shop profile</h2><p className="mt-1 text-xs leading-5 text-ink-600">ক্রেতারা আপনার seller profile-এ এই নাম, ছবি ও description দেখতে পাবে।</p></div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[180px_1fr]">
        <div>
          <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-brand-100 bg-white text-brand-600">
            {imagePreview ? <img src={imagePreview} alt="Shop preview" className="h-full w-full object-cover" /> : <ImageIcon size={34} />}
            <label className="absolute inset-x-2 bottom-2 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-ink-900/75 px-3 py-2 text-xs font-semibold text-white transition hover:bg-ink-900">
              <Camera size={14} /> ছবি পরিবর্তন
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)} />
            </label>
          </div>
          <p className="mt-2 text-center text-[11px] leading-4 text-ink-500">JPG, PNG বা WebP image ব্যবহার করুন।</p>
        </div>

        <div className="space-y-3">
          <label className="block"><span className="text-xs font-semibold text-ink-700">Shop name</span><input value={shopName} onChange={(event) => setShopName(event.target.value)} maxLength={80} placeholder="যেমন: Arian Fashion House" className="mt-1 w-full rounded-xl border border-outline bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" /><span className="mt-1 block text-right text-[11px] text-ink-400">{shopName.length}/80</span></label>
          <label className="block"><span className="text-xs font-semibold text-ink-700">Shop description</span><textarea value={shopDescription} onChange={(event) => setShopDescription(event.target.value)} maxLength={600} rows={5} placeholder="আপনার shop, পণ্য, quality বা delivery সম্পর্কে সংক্ষিপ্ত বর্ণনা লিখুন।" className="mt-1 w-full resize-y rounded-xl border border-outline bg-white px-3 py-2.5 text-sm leading-6 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" /><span className="mt-1 block text-right text-[11px] text-ink-400">{shopDescription.length}/600</span></label>
          {message && <p className={`rounded-xl px-3 py-2 text-xs leading-5 ${message.tone === 'success' ? 'bg-brand-100 text-brand-800' : 'bg-error/10 text-error'}`}>{message.text}</p>}
          <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"><Save size={15} />{saving ? 'সংরক্ষণ হচ্ছে...' : 'Shop profile সংরক্ষণ করুন'}</button>
        </div>
      </div>
    </section>
  )
}
