import { useEffect, useState } from 'react'
import { Camera, CheckCircle2, CircleAlert, ExternalLink, Image as ImageIcon, Save, Store, XCircle } from 'lucide-react'
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
    setShopName(profile.shop_name ?? ''); setShopDescription(profile.shop_description ?? ''); setShopUsername(profile.shop_username ?? ''); setShopImageUrl(profile.photo_url ?? ''); setCoverImageUrl(profile.shop_cover_url ?? ''); setImagePreview(profile.photo_url ?? ''); setCoverPreview(profile.shop_cover_url ?? ''); setShopImageFile(null); setCoverImageFile(null); setUsernameState({ status: profile.shop_username ? 'checking' : 'idle', suggestions: [] })
  }, [profile.id, profile.shop_name, profile.shop_description, profile.shop_username, profile.photo_url, profile.shop_cover_url])

  useEffect(() => {
    const normalized = normalizeShopUsername(shopUsername)
    if (normalized !== shopUsername) { setShopUsername(normalized); return }
    if (normalized.length < 3) { setUsernameState({ status: normalized ? 'invalid' : 'idle', suggestions: [] }); return }
    setUsernameState((current) => ({ ...current, status: 'checking' }))
    let active = true
    const timer = window.setTimeout(() => { void checkShopUsername(normalized, profile.id).then((result) => { if (active) setUsernameState({ status: result.is_available ? 'available' : 'taken', suggestions: result.suggestions }) }).catch(() => { if (active) setUsernameState({ status: 'invalid', suggestions: [] }) }) }, 350)
    return () => { active = false; window.clearTimeout(timer) }
  }, [profile.id, shopUsername])

  useEffect(() => { if (!imagePreview.startsWith('blob:')) return; return () => URL.revokeObjectURL(imagePreview) }, [imagePreview])
  useEffect(() => { if (!coverPreview.startsWith('blob:')) return; return () => URL.revokeObjectURL(coverPreview) }, [coverPreview])

  const handleImageChange = (file: File | null, type: 'profile' | 'cover') => {
    if (!file) return
    const validationError = validateImageFiles([file], 1)
    if (validationError) { setMessage({ tone: 'error', text: validationError }); return }
    setMessage(null)
    if (type === 'profile') { setShopImageFile(file); setImagePreview(URL.createObjectURL(file)) } else { setCoverImageFile(file); setCoverPreview(URL.createObjectURL(file)) }
  }

  const handleSave = async () => {
    const normalizedName = shopName.trim(); const normalizedDescription = shopDescription.trim(); const normalizedUsername = normalizeShopUsername(shopUsername)
    if (normalizedName.length < 2 || normalizedName.length > 80) { setMessage({ tone: 'error', text: 'শপের নাম ২ থেকে ৮০ অক্ষরের মধ্যে দিন।' }); return }
    if (normalizedDescription.length > 600) { setMessage({ tone: 'error', text: 'শপের বিবরণ সর্বোচ্চ ৬০০ অক্ষরের হতে পারবে।' }); return }
    if (usernameState.status !== 'available' || normalizedUsername !== shopUsername) { setMessage({ tone: 'error', text: 'একটি available username নির্বাচন করুন।' }); return }
    setSaving(true); setMessage(null)
    try {
      let nextImageUrl = shopImageUrl; let nextCoverUrl = coverImageUrl
      if (shopImageFile) { const [uploadedUrl] = await uploadProductImages([shopImageFile], `profile-photos/${profile.id}`); if (!uploadedUrl) throw new Error('প্রোফাইল ছবি আপলোড করা যায়নি।'); nextImageUrl = uploadedUrl }
      if (coverImageFile) { const [uploadedUrl] = await uploadProductImages([coverImageFile], `profile-covers/${profile.id}`); if (!uploadedUrl) throw new Error('কভার ছবি আপলোড করা যায়নি।'); nextCoverUrl = uploadedUrl }
      const saved = await updateSellerShopProfile({ shopName: normalizedName, shopDescription: normalizedDescription, shopUsername: normalizedUsername, photoUrl: nextImageUrl || null, coverUrl: nextCoverUrl || null })
      const nextProfile = { ...profile, ...(saved ?? {}), shop_name: normalizedName, shop_description: normalizedDescription, shop_username: normalizedUsername, photo_url: nextImageUrl || null, shop_cover_url: nextCoverUrl || null } as Profile
      onSaved(nextProfile); setShopImageUrl(nextImageUrl); setCoverImageUrl(nextCoverUrl); setShopImageFile(null); setCoverImageFile(null); setImagePreview(nextImageUrl); setCoverPreview(nextCoverUrl); setMessage({ tone: 'success', text: 'শপ প্রোফাইল আপডেট হয়েছে।' })
    } catch (error) { console.error('Shop profile save failed:', error); setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'শপ প্রোফাইল আপডেট করা যায়নি।' }) } finally { setSaving(false) }
  }

  const usernameMessage = usernameState.status === 'checking' ? 'শপের লিংক যাচাই হচ্ছে…' : usernameState.status === 'available' ? 'এই শপ লিংকটি ব্যবহার করা যাবে' : usernameState.status === 'taken' ? 'এই শপ লিংকটি ইতিমধ্যে নেওয়া হয়েছে' : usernameState.status === 'invalid' ? 'কমপক্ষে ৩ অক্ষরের ছোট হাতের শপ লিংক দিন' : 'আপনার শপের একটি সহজ ইউনিক লিংক দিন'
  const usernameTone = usernameState.status === 'available' ? 'text-brand-700' : usernameState.status === 'taken' || usernameState.status === 'invalid' ? 'text-error' : 'text-ink-500'

  return <section className="mt-6 overflow-hidden rounded-2xl border border-brand-200 bg-surface shadow-sm"><div className="bg-gradient-to-r from-brand-700 via-brand-500 to-emerald-300 px-5 py-4 text-white"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"><Store size={20} /></span><div><p className="text-xs font-medium text-white/75">সেলার প্রোফাইল</p><h2 className="mt-0.5 text-lg font-bold">আপনার শপ সম্পাদনা</h2><p className="mt-1 text-xs leading-5 text-white/85">ক্রেতারা এই নাম, ছবি, কভার ও পরিচিতি দেখবে।</p></div></div></div><div className="p-4 sm:p-6"><section className="overflow-hidden rounded-2xl border border-outline bg-bg"><div className="relative h-32 overflow-hidden bg-gradient-to-r from-brand-800 via-brand-600 to-emerald-300 sm:h-40">{coverPreview ? <img src={coverPreview} alt="শপ কভার" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm font-semibold text-white/90">শপ কভার ছবি যোগ করুন</div>}<label className="absolute bottom-3 right-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-ink-900/75 px-3 py-2 text-xs font-bold text-white hover:bg-ink-900"><Camera size={14} />কভার পরিবর্তন<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => handleImageChange(event.target.files?.[0] ?? null, 'cover')} /></label></div><div className="relative flex min-h-24 items-end px-4 pb-4 sm:px-5"><div className="relative -mt-12 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-brand-100 text-3xl font-bold text-brand-700 shadow-md">{imagePreview ? <img src={imagePreview} alt="শপ প্রোফাইল" className="h-full w-full object-cover" /> : <ImageIcon size={34} />}<label className="absolute inset-x-1 bottom-1 flex cursor-pointer items-center justify-center gap-1 rounded-lg bg-ink-900/75 px-2 py-1.5 text-[11px] font-bold text-white"><Camera size={12} />ছবি<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => handleImageChange(event.target.files?.[0] ?? null, 'profile')} /></label></div><div className="mb-1 ml-3 min-w-0"><p className="truncate text-lg font-bold text-ink-900">{shopName || 'আপনার শপ'}</p><p className="text-xs text-ink-500">পাবলিক শপ প্রোফাইল প্রিভিউ</p></div></div></section>
    <div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-outline bg-surface p-4 sm:p-5"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Store size={16} /></span><div><h3 className="font-bold text-ink-900">শপের পরিচয়</h3><p className="text-xs text-ink-500">নাম ও সংক্ষিপ্ত পরিচিতি</p></div></div><label className="mt-4 block"><span className="text-sm font-semibold text-ink-800">শপের নাম</span><input value={shopName} onChange={(event) => setShopName(event.target.value)} maxLength={80} placeholder="যেমন: Shavora Digital" className="mt-1.5 w-full rounded-xl border border-outline bg-bg px-3 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /><span className="mt-1 block text-right text-[11px] text-ink-400">{shopName.length}/80</span></label><label className="mt-4 block"><span className="text-sm font-semibold text-ink-800">শপের বিবরণ</span><textarea value={shopDescription} onChange={(event) => setShopDescription(event.target.value)} maxLength={600} rows={5} placeholder="আপনার শপ, পণ্য বা সেবা সম্পর্কে সংক্ষিপ্ত বর্ণনা লিখুন।" className="mt-1.5 w-full resize-y rounded-xl border border-outline bg-bg px-3 py-3 text-sm leading-6 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" /><span className="mt-1 block text-right text-[11px] text-ink-400">{shopDescription.length}/600</span></label></section>
      <section className="rounded-2xl border border-outline bg-surface p-4 sm:p-5"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><ExternalLink size={16} /></span><div><h3 className="font-bold text-ink-900">শপের পাবলিক লিংক</h3><p className="text-xs text-ink-500">ক্রেতারা এই লিংকেই আপনার শপে আসবে</p></div></div><label className="mt-4 block"><span className="text-sm font-semibold text-ink-800">ইউনিক শপ username</span><div className="mt-1.5 flex overflow-hidden rounded-xl border border-outline bg-bg focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/10"><span className="flex shrink-0 items-center border-r border-outline bg-surface px-3 text-xs font-semibold text-ink-500">/seller/</span><input value={shopUsername} onChange={(event) => setShopUsername(normalizeShopUsername(event.target.value))} maxLength={40} placeholder="your-shop" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none" /></div></label><p className={`mt-2 flex items-start gap-1.5 text-xs leading-5 ${usernameTone}`}>{usernameState.status === 'available' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : usernameState.status === 'taken' || usernameState.status === 'invalid' ? <XCircle size={15} className="mt-0.5 shrink-0" /> : <CircleAlert size={15} className="mt-0.5 shrink-0" />}{usernameMessage}</p>{usernameState.suggestions.length > 0 && <div className="mt-4 rounded-xl bg-brand-50 p-3"><p className="text-xs font-semibold text-brand-800">উপলব্ধ বিকল্প</p><div className="mt-2 flex flex-wrap gap-2">{usernameState.suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setShopUsername(suggestion)} className="rounded-lg border border-brand-200 bg-surface px-2.5 py-1.5 text-xs font-bold text-brand-700 hover:border-brand-500">{suggestion}</button>)}</div></div>}<div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/60 p-3"><p className="text-xs font-semibold text-brand-800">আপনার শপের লিংক</p><p className="mt-1 break-all text-sm font-bold text-brand-700">bikrikoro.com/seller/{shopUsername || 'your-shop'}</p></div></section></div>
    {message && <p className={`mt-5 rounded-xl px-4 py-3 text-sm leading-5 ${message.tone === 'success' ? 'bg-brand-50 text-brand-800' : 'bg-error/10 text-error'}`}>{message.text}</p>}<div className="mt-5 flex justify-end border-t border-outline pt-5"><button type="button" onClick={handleSave} disabled={saving || usernameState.status === 'checking'} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"><Save size={16} />{saving ? 'সংরক্ষণ হচ্ছে…' : 'শপ প্রোফাইল সংরক্ষণ করুন'}</button></div></div></section>
}
