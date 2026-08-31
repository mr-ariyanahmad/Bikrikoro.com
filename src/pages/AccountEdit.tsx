import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BadgeCheck, Camera, LockKeyhole, Mail, Save, Store } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { uploadProductImages } from '@/lib/storage'
import { validateImageFiles } from '@/lib/fileValidation'
import { useIsSeller } from '@/hooks/useIsSeller'
import { readCachedValue, userCacheKey, writeCachedValue } from '@/lib/clientCache'
import type { Profile } from '@/types/product'

const ACCOUNT_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

function maskEmail(value: string | null | undefined) {
  if (!value) return 'যোগ করা হয়নি'
  const [name, domain] = value.split('@')
  return domain ? `${name.slice(0, 2)}${'•'.repeat(Math.max(3, name.length - 2))}@${domain}` : value
}

export default function AccountEdit() {
  const { user, changePassword, sendVerificationEmail } = useAuth()
  const { isSeller, loading: sellerLoading } = useIsSeller()
  const navigate = useNavigate()
  const uid = user!.uid
  const cacheKey = userCacheKey(uid, 'account-profile')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopDescription, setShopDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [securitySaving, setSecuritySaving] = useState(false)
  const [verificationSending, setVerificationSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const hydrate = (data: Profile | null) => {
      setProfile(data)
      setName(data?.name ?? '')
      setShopName(data?.shop_name ?? '')
      setShopDescription(data?.shop_description ?? '')
    }
    const cached = readCachedValue<Profile>(cacheKey, ACCOUNT_CACHE_MAX_AGE_MS)
    if (cached) { hydrate(cached.value); setLoading(false) } else setLoading(true)
    supabase.from('profiles').select('*').eq('id', uid).maybeSingle().then(({ data }) => {
      hydrate(data)
      if (data) writeCachedValue(cacheKey, data as Profile)
      setLoading(false)
    }, () => setLoading(false))
  }, [cacheKey, uid])

  const completionPercent = useMemo(() => {
    const completed = [Boolean(profile?.photo_url), Boolean(name.trim() && name.trim().length >= 2), Boolean(user?.email), Boolean(user?.emailVerified), ...(isSeller ? [Boolean(shopName.trim()), Boolean(shopDescription.trim())] : [])].filter(Boolean).length
    const total = isSeller ? 6 : 4
    return Math.round((completed / total) * 100)
  }, [isSeller, name, profile?.photo_url, shopDescription, shopName, user?.email, user?.emailVerified])

  const persistProfile = (next: Profile) => {
    setProfile(next)
    writeCachedValue(cacheKey, next)
  }
  const notify = (text: string) => { setMessage(text); window.setTimeout(() => setMessage(null), 3000) }

  const handlePhotoChange = async (file: File) => {
    const fileError = validateImageFiles([file], 1)
    if (fileError) { notify(fileError); return }
    setUploadingPhoto(true)
    try {
      const [url] = await uploadProductImages([file], `profile-photos/${uid}`)
      const { error } = await supabase.from('profiles').update({ photo_url: url }).eq('id', uid)
      if (error) throw error
      if (profile) persistProfile({ ...profile, photo_url: url })
      notify('প্রোফাইল ছবি আপডেট হয়েছে।')
    } catch (error) { notify(error instanceof Error ? error.message : 'ছবি আপলোড করা যায়নি।') } finally { setUploadingPhoto(false) }
  }

  const handleSave = async () => {
    if (name.trim().length < 2) { notify('নাম কমপক্ষে ২ অক্ষরের হতে হবে।'); return }
    setSaving(true)
    const changes = isSeller ? { name: name.trim(), shop_name: shopName.trim() || null, shop_description: shopDescription.trim() || null } : { name: name.trim() }
    const { data, error } = await supabase.from('profiles').update(changes).eq('id', uid).select('*').maybeSingle()
    setSaving(false)
    if (error) { notify('সেভ করা যায়নি — আবার চেষ্টা করুন।'); return }
    if (data) persistProfile(data as Profile)
    notify('প্রোফাইল তথ্য সেভ হয়েছে।')
  }

  const handlePassword = async () => {
    if (newPassword.length < 6) { notify('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'); return }
    if (newPassword !== confirmPassword) { notify('দুটি পাসওয়ার্ড এক নয়।'); return }
    setSecuritySaving(true)
    try { await changePassword(newPassword); setNewPassword(''); setConfirmPassword(''); notify('পাসওয়ার্ড পরিবর্তন হয়েছে।') } catch { notify('পাসওয়ার্ড পরিবর্তন করা যায়নি। আবার চেষ্টা করুন।') } finally { setSecuritySaving(false) }
  }

  const handleVerification = async () => {
    setVerificationSending(true)
    try { await sendVerificationEmail(); notify('ভেরিফিকেশন ইমেইল পাঠানো হয়েছে।') } catch { notify('ভেরিফিকেশন ইমেইল পাঠানো যায়নি।') } finally { setVerificationSending(false) }
  }

  if (loading) return <Layout wide><div className="h-72 animate-pulse rounded-[1.35rem] border border-outline/70 bg-surface shadow-sm" /></Layout>
  const displayName = profile?.name?.trim() || user?.displayName?.trim() || 'BikriKoro সদস্য'

  return <Layout wide><Helmet><title>প্রোফাইল সম্পাদনা | BikriKoro.Com</title></Helmet><div className="mx-auto w-full max-w-3xl pb-24"><div className="flex items-center gap-3"><button type="button" onClick={() => navigate('/account')} className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-outline bg-surface text-ink-700 shadow-sm transition hover:border-brand-500 hover:text-brand-700 active:scale-[0.97]" aria-label="প্রোফাইলে ফিরে যান"><ArrowLeft size={20} /></button><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">অ্যাকাউন্ট সেটিংস</p><h1 className="text-2xl font-bold text-ink-900">প্রোফাইল সম্পাদনা</h1></div></div>
    <section className="mt-5 overflow-hidden rounded-[1.35rem] border border-brand-100 bg-surface shadow-[0_14px_36px_rgba(15,23,42,0.065)]"><div className="bg-gradient-to-r from-brand-700 to-brand-500 px-5 py-4 text-white"><p className="text-xs text-white/80">আপনার পরিচয় ও শপের তথ্য</p><p className="mt-1 text-lg font-bold">{completionPercent}% সম্পূর্ণ</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${completionPercent}%` }} /></div></div><div className="p-5 sm:p-6"><div className="flex flex-col items-center gap-3 border-b border-outline pb-6 sm:flex-row"><div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-3xl font-bold text-brand-700">{profile?.photo_url ? <img src={profile.photo_url} alt="" className="h-full w-full object-cover" /> : displayName.charAt(0)}{uploadingPhoto && <span className="absolute inset-0 grid place-items-center bg-ink-900/45"><span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" /></span>}</div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm font-bold text-brand-700 hover:border-brand-500"><Camera size={17} />{uploadingPhoto ? 'ছবি আপলোড হচ্ছে…' : 'ছবি পরিবর্তন করুন'}<input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto} onChange={(event) => { const file = event.target.files?.[0]; if (file) void handlePhotoChange(file); event.target.value = '' }} /></label></div>
      <div className="mt-6 space-y-5"><label className="block"><span className="mb-1.5 block text-sm font-bold text-ink-900">আপনার নাম</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" placeholder="আপনার নাম লিখুন" /></label>
      {!sellerLoading && isSeller && <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4"><div className="flex items-center gap-2"><Store size={18} className="text-brand-700" /><h2 className="font-bold text-ink-900">শপের পাবলিক তথ্য</h2></div><p className="mt-1 text-xs leading-5 text-ink-600">এই তথ্য আপনার public shop profile-এ দেখা যাবে।</p><label className="mt-4 block"><span className="mb-1.5 block text-sm font-semibold text-ink-900">শপের নাম</span><input value={shopName} onChange={(event) => setShopName(event.target.value)} maxLength={80} className="w-full rounded-xl border border-outline bg-surface px-3 py-3 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" placeholder="যেমন: আমার ডিজিটাল শপ" /></label><label className="mt-4 block"><span className="mb-1.5 block text-sm font-semibold text-ink-900">শপ সম্পর্কে</span><textarea value={shopDescription} onChange={(event) => setShopDescription(event.target.value)} rows={4} maxLength={280} className="w-full resize-none rounded-xl border border-outline bg-surface px-3 py-3 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10" placeholder="আপনার শপ ও পণ্যের সংক্ষিপ্ত পরিচয় লিখুন" /><span className="mt-1 block text-right text-xs text-ink-400">{shopDescription.length}/280</span></label>{profile?.shop_username && <p className="mt-2 text-xs text-ink-500">শপের লিংক: <Link to={`/seller/${profile.shop_username}`} className="font-semibold text-brand-700">bikrikoro.com/seller/{profile.shop_username}</Link></p>}</div>}
      <button type="button" onClick={() => void handleSave()} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-wait disabled:opacity-60"><Save size={17} />{saving ? 'সেভ হচ্ছে…' : 'পরিবর্তন সেভ করুন'}</button></div></div></section>
    <section className="mt-5 rounded-[1.35rem] border border-brand-100 bg-surface p-5 shadow-[0_10px_26px_rgba(15,23,42,0.045)] sm:p-6"><div className="flex items-center gap-2"><LockKeyhole size={19} className="text-brand-700" /><h2 className="text-lg font-bold text-ink-900">লগইন ও নিরাপত্তা</h2></div><div className="mt-4 rounded-2xl border border-outline/70 bg-bg p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium text-ink-500">ইমেইল</p><p className="mt-1 font-semibold text-ink-900">{maskEmail(user?.email || profile?.email)}</p></div>{user?.emailVerified ? <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700"><BadgeCheck size={14} />ভেরিফাইড</span> : <button type="button" onClick={() => void handleVerification()} disabled={verificationSending} className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{verificationSending ? 'পাঠানো হচ্ছে…' : 'ভেরিফাই করুন'}</button>}</div><p className="mt-3 inline-flex items-start gap-2 text-xs leading-5 text-ink-500"><Mail size={14} className="mt-0.5 shrink-0" />ইমেইল বা ফোন নম্বর Google/লগইন পদ্ধতির সঙ্গে যুক্ত; নিরাপত্তার জন্য এখান থেকে পরিবর্তন করা যায় না।</p></div>
    {user?.providerData.some((provider) => provider.providerId === 'password') && <div className="mt-5 space-y-3 border-t border-outline pt-5"><p className="text-sm font-bold text-ink-900">পাসওয়ার্ড পরিবর্তন</p><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)" className="w-full rounded-xl border border-outline px-3 py-3 text-sm outline-none focus:border-brand-500" /><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="নতুন পাসওয়ার্ড আবার লিখুন" className="w-full rounded-xl border border-outline px-3 py-3 text-sm outline-none focus:border-brand-500" /><button type="button" onClick={() => void handlePassword()} disabled={securitySaving} className="w-full rounded-xl border border-brand-500 px-4 py-3 text-sm font-bold text-brand-700 hover:bg-brand-50 disabled:opacity-60">{securitySaving ? 'সেভ হচ্ছে…' : 'পাসওয়ার্ড পরিবর্তন করুন'}</button></div>}</section>
    {message && <div role="status" className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl bg-ink-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-xl">{message}</div>}</div></Layout>
}
