import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { supabase } from '@/lib/supabase'
import { uploadVerificationDocument, getVerificationDocUrl, submitSellerRegistration } from '@/lib/verification'
import type { SellerRegistration, SellerType } from '@/types/chat'

export default function SellerVerification() {
  const { user } = useAuth()
  const uid = user!.uid

  const [existing, setExisting] = useState<SellerRegistration | null>(null)
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [sellerType, setSellerType] = useState<SellerType>('INDIVIDUAL')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [address, setAddress] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('seller_registrations')
        .select('*')
        .eq('user_id', uid)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      setExisting(data)
      if (data) {
        const url = await getVerificationDocUrl(data.document_path)
        setDocPreviewUrl(url)
      }
      setLoading(false)
    }
    load()
  }, [uid])

  const isValid =
    fullName.trim().length >= 3 &&
    phone.trim().length >= 11 &&
    idNumber.trim().length >= 5 &&
    address.trim().length >= 5 &&
    file !== null &&
    (sellerType === 'INDIVIDUAL' || businessName.trim().length >= 2)

  const handleSubmit = async () => {
    if (!isValid || !file) return
    setSubmitting(true)
    setError(null)

    try {
      const documentPath = await uploadVerificationDocument(file, uid)
      await submitSellerRegistration({
        userId: uid,
        sellerType,
        fullName: fullName.trim(),
        phone: phone.trim(),
        nidOrBusinessNumber: idNumber.trim(),
        businessName: sellerType === 'BUSINESS' ? businessName.trim() : null,
        address: address.trim(),
        documentPath,
      })
      window.location.reload()
    } catch (err) {
      console.error('Seller registration submit failed:', err)
      const message =
        err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : ''
      setError(`আবেদন জমা দেওয়া যায়নি — আবার চেষ্টা করুন।${message ? ` (${message})` : ''}`)
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="h-72 animate-pulse rounded-2xl bg-outline/40" />
      </Layout>
    )
  }

  if (existing) {
    return (
      <Layout>
        <h1 className="text-xl font-semibold text-ink-900">সেলার ভেরিফিকেশন</h1>
        <div className="mt-5 rounded-2xl border border-outline bg-surface p-5">
          <StatusBadge status={existing.status} />
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="নাম" value={existing.full_name} />
            <Row label="ধরন" value={existing.seller_type === 'INDIVIDUAL' ? 'ব্যক্তিগত' : 'ব্যবসায়িক'} />
            {existing.business_name && <Row label="ব্যবসার নাম" value={existing.business_name} />}
            <Row label="জমা দেওয়া হয়েছে" value={new Date(existing.submitted_at).toLocaleDateString('bn-BD')} />
          </dl>
          {docPreviewUrl && (
            <img src={docPreviewUrl} alt="জমা দেওয়া ডকুমেন্ট" className="mt-4 max-h-48 rounded-lg border border-outline" />
          )}
          {existing.status === 'REJECTED' && existing.admin_note && (
            <p className="mt-4 rounded-lg bg-error/10 p-3 text-sm text-error">{existing.admin_note}</p>
          )}
          {existing.status === 'REJECTED' && (
            <button
              onClick={() => setExisting(null)}
              className="mt-4 rounded-lg border border-outline px-4 py-2 text-sm font-medium text-ink-600 hover:border-brand-500"
            >
              আবার আবেদন করুন
            </button>
          )}
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <h1 className="text-xl font-semibold text-ink-900">সেলার ভেরিফিকেশন</h1>
      <p className="mt-1 text-sm text-ink-600">
        ভেরিফাই করা সেলারের প্রোফাইলে একটা ব্যাজ দেখা যায়, যা ক্রেতাদের বাড়তি আস্থা দেয়।
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">ধরন</label>
          <div className="flex rounded-lg border border-outline p-1">
            {(['INDIVIDUAL', 'BUSINESS'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSellerType(t)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  sellerType === t ? 'bg-brand-500 text-white' : 'text-ink-600'
                }`}
              >
                {t === 'INDIVIDUAL' ? 'ব্যক্তিগত' : 'ব্যবসায়িক'}
              </button>
            ))}
          </div>
        </div>

        <Field label="পূর্ণ নাম" value={fullName} onChange={setFullName} placeholder="আপনার আইডি অনুযায়ী নাম" />
        <Field label="ফোন নম্বর" value={phone} onChange={setPhone} placeholder="০১XXXXXXXXX" type="tel" />
        <Field
          label={sellerType === 'INDIVIDUAL' ? 'NID নম্বর' : 'ট্রেড লাইসেন্স নম্বর'}
          value={idNumber}
          onChange={setIdNumber}
        />
        {sellerType === 'BUSINESS' && (
          <Field label="ব্যবসার নাম" value={businessName} onChange={setBusinessName} />
        )}
        <Field label="ঠিকানা" value={address} onChange={setAddress} />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-ink-900">
            {sellerType === 'INDIVIDUAL' ? 'NID কার্ডের ছবি' : 'ট্রেড লাইসেন্সের ছবি'}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-ink-600"
          />
          <p className="mt-1 text-xs text-ink-300">এই ডকুমেন্ট শুধু BikriKoro পর্যালোচনার জন্য ব্যবহৃত হবে, কোথাও প্রকাশ করা হবে না।</p>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'জমা হচ্ছে...' : 'আবেদন জমা দিন'}
        </button>
      </div>
    </Layout>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-900">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-600">{label}</dt>
      <dd className="font-medium text-ink-900">{value}</dd>
    </div>
  )
}

function StatusBadge({ status }: { status: SellerRegistration['status'] }) {
  const config = {
    PENDING: { label: 'পর্যালোচনাধীন', className: 'bg-warning/10 text-warning' },
    APPROVED: { label: 'অনুমোদিত ✓', className: 'bg-brand-100 text-brand-700' },
    REJECTED: { label: 'বাতিল হয়েছে', className: 'bg-error/10 text-error' },
  }[status]

  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${config.className}`}>
      {config.label}
    </span>
  )
}
