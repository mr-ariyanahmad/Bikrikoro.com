import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, BookmarkPlus, Heart, ShoppingBag, Store, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
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

export default function Account() {
  const { user, changePassword, sendVerificationEmail } = useAuth()
  const { isSeller, loading: sellerStatusLoading } = useIsSeller()
  const uid = user!.uid

  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [securitySaving, setSecuritySaving] = useState(false)
  const [verificationSending, setVerificationSending] = useState(false)
  const [securityError, setSecurityError] = useState<string | null>(null)
  const cacheKey = userCacheKey(uid, 'account-profile')

  useEffect(() => {
    const cached = readCachedValue<Profile>(cacheKey, ACCOUNT_CACHE_MAX_AGE_MS)
    if (cached) {
      setProfile(cached.value)
      setName(cached.value.name ?? '')
      setLoading(false)
    } else {
      setLoading(true)
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data)
        setName(data?.name ?? '')
        if (data) writeCachedValue(cacheKey, data as Profile)
        setLoading(false)
      }, () => setLoading(false))
  }, [cacheKey, uid])

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const handlePhotoChange = async (file: File) => {
    const fileError = validateImageFiles([file], 1)
    if (fileError) { showToast(fileError); return }
    setUploadingPhoto(true)
    try {
      // Reuses the product-images bucket under a profile-photos/ prefix
      // rather than adding a dedicated bucket for one small feature —
      // bucket policies only key off bucket_id, so this is safe.
      const [url] = await uploadProductImages([file], `profile-photos/${uid}`)
      const { error } = await supabase.from('profiles').update({ photo_url: url }).eq('id', uid)
      if (error) throw error
      setProfile((prev) => (prev ? { ...prev, photo_url: url } : prev))
      showToast('ছবি আপডেট হয়েছে।')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ছবি আপলোড করা যায়নি।')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSave = async () => {
    if (name.trim().length < 2) {
      showToast('নাম কমপক্ষে ২ অক্ষরের হতে হবে।')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ name: name.trim() }).eq('id', uid)
    setSaving(false)
    if (error) {
      showToast('সেভ করা যায়নি — আবার চেষ্টা করুন।')
      return
    }
    showToast('প্রোফাইল আপডেট হয়েছে।')
  }

  const handleChangePassword = async () => {
    setSecurityError(null)
    if (newPassword.length < 6) {
      setSecurityError('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।')
      return
    }
    if (newPassword !== confirmPassword) {
      setSecurityError('দুটি পাসওয়ার্ড এক নয়।')
      return
    }
    setSecuritySaving(true)
    try {
      await changePassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      showToast('পাসওয়ার্ড পরিবর্তন হয়েছে।')
    } catch (err) {
      console.error('password change failed:', err)
      const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
      setSecurityError(
        code === 'auth/requires-recent-login'
          ? 'নিরাপত্তার জন্য আগে লগআউট করে আবার লগইন করুন, তারপর চেষ্টা করুন।'
          : 'পাসওয়ার্ড পরিবর্তন করা যায়নি। আবার চেষ্টা করুন.'
      )
    } finally {
      setSecuritySaving(false)
    }
  }

  const handleSendVerification = async () => {
    setSecurityError(null)
    setVerificationSending(true)
    try {
      await sendVerificationEmail()
      showToast('ভেরিফিকেশন ইমেইল পাঠানো হয়েছে।')
    } catch (err) {
      console.error('verification email failed:', err)
      setSecurityError('ভেরিফিকেশন ইমেইল পাঠানো যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।')
    } finally {
      setVerificationSending(false)
    }
  }

  if (loading) {
    return (
      <Layout wide>
        <div className="h-72 animate-pulse rounded-2xl bg-outline/40" />
      </Layout>
    )
  }

  return (
    <Layout wide>
      <Helmet>
        <title>অ্যাকাউন্ট সেটিংস | BikriKoro.Com</title>
      </Helmet>

      <h1 className="text-xl font-semibold text-ink-900">অ্যাকাউন্ট সেটিংস</h1>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{[["/orders", "অর্ডার", ShoppingBag], ["/favorites", "পছন্দের তালিকা", Heart], ["/saved-searches", "সেভড সার্চ", BookmarkPlus], ["/wallet", "ওয়ালেট", WalletCards], ["/library", "লাইব্রেরি", BookOpen]].map(([to, label, Icon]) => <Link key={to as string} to={to as string} className="group rounded-2xl border border-outline bg-surface p-3 transition hover:border-brand-500 hover:bg-brand-50"><span className="flex items-center justify-between"><Icon size={17} className="text-brand-600" /><ArrowRight size={14} className="text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" /></span><span className="mt-2 block text-xs font-semibold text-ink-700">{label as string}</span></Link>)}{!sellerStatusLoading && isSeller && <Link to="/seller/dashboard" className="group rounded-2xl border border-brand-200 bg-brand-50 p-3 transition hover:border-brand-500"><span className="flex items-center justify-between"><Store size={17} className="text-brand-600" /><ArrowRight size={14} className="text-brand-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" /></span><span className="mt-2 block text-xs font-semibold text-brand-800">সেলার অ্যাকাউন্ট</span></Link>}</div>

      <div className="mt-6 flex items-center gap-4">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-2xl font-semibold text-brand-700">
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (name || 'ব').charAt(0)
            )}
          </div>
          {uploadingPhoto && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-ink-900/40">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>
        <label className="cursor-pointer rounded-lg border border-outline px-4 py-2 text-sm font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600">
          ছবি পরিবর্তন করুন
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handlePhotoChange(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">নাম</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {profile?.phone && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">ফোন নম্বর</label>
            <div className="flex items-center justify-between rounded-lg bg-bg px-3 py-2.5 text-sm text-ink-600">
              <span>{profile.phone}</span>
              <span className="text-xs text-brand-600">যাচাইকৃত ✓</span>
            </div>
          </div>
        )}

        {profile?.email && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">ইমেইল</label>
            <div className="rounded-lg bg-bg px-3 py-2.5 text-sm text-ink-600">{profile.email}</div>
          </div>
        )}

        <p className="text-xs text-ink-300">
          ফোন/ইমেইল পরিবর্তন করতে চাইলে লগআউট করে সেই নম্বর/ইমেইল দিয়ে আবার লগইন করুন — এগুলো সরাসরি লগইন পদ্ধতির সাথে
          যুক্ত থাকে বলে এখান থেকে বদলানো যায় না।
        </p>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'সেভ হচ্ছে...' : 'পরিবর্তন সেভ করুন'}
        </button>
      </div>

      <section className="mt-8 rounded-2xl border border-outline bg-surface p-5">
        <h2 className="text-lg font-semibold text-ink-900">নিরাপত্তা</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-600">
          আপনার অ্যাকাউন্ট সুরক্ষিত রাখতে পাসওয়ার্ড পরিবর্তন করুন এবং ইমেইল ভেরিফাই করে রাখুন।
        </p>

        {user?.email && (
          <div className="mt-4 rounded-xl bg-bg p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-ink-600">{user.email}</span>
              {user.emailVerified ? (
                <span className="shrink-0 font-medium text-brand-600">ভেরিফাইড ✓</span>
              ) : (
                <button
                  onClick={handleSendVerification}
                  disabled={verificationSending}
                  className="shrink-0 text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
                >
                  {verificationSending ? 'পাঠানো হচ্ছে...' : 'ভেরিফাই করুন'}
                </button>
              )}
            </div>
          </div>
        )}

        {user?.providerData.some((provider) => provider.providerId === 'password') && (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-ink-900" htmlFor="new-password">
              নতুন পাসওয়ার্ড
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="কমপক্ষে ৬ অক্ষর"
              className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <label className="block text-sm font-medium text-ink-900" htmlFor="confirm-password">
              নতুন পাসওয়ার্ড আবার লিখুন
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="পাসওয়ার্ড মিলিয়ে দিন"
              className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <button
              onClick={handleChangePassword}
              disabled={securitySaving}
              className="w-full rounded-xl border border-brand-500 py-3 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 disabled:opacity-50"
            >
              {securitySaving ? 'সেভ হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন করুন'}
            </button>
          </div>
        )}
        {securityError && <p className="mt-3 text-sm text-error">{securityError}</p>}
      </section>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-ink-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </Layout>
  )
}
