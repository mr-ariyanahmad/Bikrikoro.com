import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { uploadProductImages } from '@/lib/storage'
import type { Profile } from '@/types/product'

export default function Account() {
  const { user } = useAuth()
  const uid = user!.uid

  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data)
        setName(data?.name ?? '')
        setLoading(false)
      })
  }, [uid])

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const handlePhotoChange = async (file: File) => {
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
    } catch {
      showToast('ছবি আপলোড করা যায়নি।')
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

  if (loading) {
    return (
      <Layout>
        <div className="h-72 animate-pulse rounded-2xl bg-outline/40" />
      </Layout>
    )
  }

  return (
    <Layout>
      <Helmet>
        <title>অ্যাকাউন্ট সেটিংস | BikriKoro.Com</title>
      </Helmet>

      <h1 className="text-xl font-semibold text-ink-900">অ্যাকাউন্ট সেটিংস</h1>

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
              if (file) handlePhotoChange(file)
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

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-ink-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </Layout>
  )
}
