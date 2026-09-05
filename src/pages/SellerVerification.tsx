import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, Camera, CheckCircle2, ChevronLeft, Clock3, Eye, FileCheck2, Pencil, ShieldCheck, Store, Upload, X, XCircle } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { BrandSelect } from '@/components/BrandSelect'
import { auth } from '@/lib/firebase'
import { getSellerDocumentRequirements, getVerificationDocUrl, submitSellerRegistrationV2, uploadVerificationDocuments } from '@/lib/verification'
import type { BusinessType, ListingMode, SellerRegistration } from '@/types/chat'
import { validateVerificationFile } from '@/lib/fileValidation'
import { CameraCapture } from '@/components/CameraCapture'
import { checkShopUsername, normalizeShopUsername } from '@/lib/shopProfile'
import { NidGuideCard, NidSelfieGuideCard, OwnershipProofGuideCard } from '@/components/NidGuideCard'
import { VerificationDocumentPicker } from '@/components/VerificationDocumentPicker'

type Requirement = { document_type: string; document_label: string; help_text: string; required: boolean; sort_order: number }
type UsernameState = { status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid'; suggestions: string[] }

function formatVerificationStatusError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const normalized = message.toLowerCase()
  if (normalized.includes('service-account') || normalized.includes('service configuration') || normalized.includes('supabase server configuration')) return 'সাইটের নিরাপদ server configuration সম্পূর্ণ নেই। Admin-কে Vercel server variables যাচাই করতে হবে।'
  if (normalized.includes('firebase') || normalized.includes('session') || normalized.includes('authentication')) return 'আপনার login session পাওয়া যায়নি। আবার login করে চেষ্টা করুন।'
  if (normalized.includes('failed to fetch') || normalized.includes('network')) return 'ইন্টারনেট বা server connection সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
  return 'আগের verification status লোড করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।'
}
const SECTORS = [['SOFTWARE', 'সফটওয়্যার / SaaS'], ['EDUCATION', 'শিক্ষা / কোর্স'], ['CREATIVE', 'সৃজনশীল / মিডিয়া'], ['RETAIL', 'রিটেইল / রিসেলার'], ['SERVICES', 'পেশাগত সেবা'], ['OTHER', 'অন্যান্য']] as const
const commonNidRequirements: Requirement[] = [
  { document_type: 'NID_FRONT', document_label: 'NID-এর সামনের অংশ', help_text: 'কার্ডের চার কোণা, নাম ও ছবি পরিষ্কার দেখা যাবে।', required: true, sort_order: 10 },
  { document_type: 'NID_BACK', document_label: 'NID-এর পেছনের অংশ', help_text: 'লেখা, QR/barcode এবং চার কোণা পরিষ্কার দেখা যাবে।', required: true, sort_order: 20 },
]
const FALLBACK_REQUIREMENTS_BY_TYPE: Record<BusinessType, Requirement[]> = {
  PERSONAL: [...commonNidRequirements, { document_type: 'SELFIE', document_label: 'NID হাতে সেলফি', help_text: 'মুখ খোলা এবং হাতে ধরা NID একই ছবিতে পরিষ্কার দেখা যাবে।', required: true, sort_order: 30 }, { document_type: 'OWNERSHIP_PROOF', document_label: 'ডিজিটাল পণ্যের মালিকানার প্রমাণ', help_text: 'নিজের তৈরি কাজ, license বা source ownership-এর প্রমাণ দিন।', required: true, sort_order: 40 }],
  BUSINESS: [...commonNidRequirements, { document_type: 'TRADE_LICENSE', document_label: 'Trade License', help_text: 'ব্যবসার নাম, ঠিকানা ও validity-সহ বর্তমান কপি দিন।', required: true, sort_order: 30 }, { document_type: 'TIN_CERTIFICATE', document_label: 'e-TIN Certificate', help_text: 'ব্যবসার tax identity-এর বর্তমান কপি দিন।', required: true, sort_order: 40 }, { document_type: 'AUTHORIZATION_LETTER', document_label: 'ব্যবসার authorization letter', help_text: 'আপনি মালিক নন, প্রতিনিধি হলে signed authorization দিন।', required: false, sort_order: 50 }, { document_type: 'OWNERSHIP_PROOF', document_label: 'ডিজিটাল পণ্যের মালিকানার প্রমাণ', help_text: 'নিজের তৈরি কাজ, license বা source ownership-এর প্রমাণ দিন।', required: true, sort_order: 60 }],
  COMPANY: [...commonNidRequirements, { document_type: 'TRADE_LICENSE', document_label: 'Company Trade License', help_text: 'কোম্পানির নাম, ঠিকানা ও validity-সহ বর্তমান কপি দিন।', required: true, sort_order: 30 }, { document_type: 'TIN_CERTIFICATE', document_label: 'Company e-TIN Certificate', help_text: 'কোম্পানির tax identity-এর বর্তমান কপি দিন।', required: true, sort_order: 40 }, { document_type: 'BIN_VAT', document_label: 'BIN/VAT Certificate', help_text: 'প্রযোজ্য হলে কোম্পানির বর্তমান BIN/VAT কপি দিন।', required: true, sort_order: 50 }, { document_type: 'INCORPORATION_CERTIFICATE', document_label: 'Company Registration Certificate', help_text: 'কোম্পানি registration/incorporation-এর প্রমাণ দিন।', required: true, sort_order: 60 }, { document_type: 'AUTHORIZATION_LETTER', document_label: 'Authorized representative letter', help_text: 'কোম্পানির পক্ষে আবেদন করলে signed authorization দিন।', required: true, sort_order: 70 }, { document_type: 'OWNERSHIP_PROOF', document_label: 'ডিজিটাল পণ্যের মালিকানার প্রমাণ', help_text: 'কোম্পানি কীভাবে পণ্যের মালিক তা প্রমাণ দিন।', required: true, sort_order: 80 }],
}

export default function SellerVerification() {
  const { user } = useAuth()
  const uid = user!.uid
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const businessTypeFromUrl = searchParams.get('businessType') as BusinessType | null
  const [existing, setExisting] = useState<SellerRegistration | null>(null)
  const [previousRejectionNote, setPreviousRejectionNote] = useState<string | null>(null)
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusLoadError, setStatusLoadError] = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)
  const [loadingRequirements, setLoadingRequirements] = useState(false)
  const [requirementsError, setRequirementsError] = useState<string | null>(null)
  const [requirements, setRequirements] = useState<Requirement[]>(FALLBACK_REQUIREMENTS_BY_TYPE.PERSONAL)
  const listingMode: ListingMode = 'DIGITAL'
  const [businessType, setBusinessType] = useState<BusinessType | null>(businessTypeFromUrl && ['PERSONAL', 'BUSINESS', 'COMPANY'].includes(businessTypeFromUrl) ? businessTypeFromUrl : null)
  const [sector, setSector] = useState('OTHER')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [shopName, setShopName] = useState('')
  const [shopUsername, setShopUsername] = useState('')
  const [usernameState, setUsernameState] = useState<UsernameState>({ status: 'idle', suggestions: [] })
  const [address, setAddress] = useState('')
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [previewDocument, setPreviewDocument] = useState<Requirement | null>(null)
  const [cameraRequirement, setCameraRequirement] = useState<Requirement | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const loadRegistration = async () => {
      try {
        setStatusLoadError(null)
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('আপনার সেশন পাওয়া যায়নি। আবার লগইন করুন।')
        const response = await fetch('/api/seller-verification-status', { headers: { Authorization: `Bearer ${idToken}` } })
        const payload = await response.json().catch(() => ({})) as { error?: string; registration?: SellerRegistration | null }
        if (!response.ok) throw new Error(payload.error || `Verification status load failed (HTTP ${response.status})`)
        if (!active) return
        const registration = payload.registration ?? null
        setExisting(registration?.status === 'REJECTED' ? null : registration)
        setPreviousRejectionNote(registration?.status === 'REJECTED' ? registration.admin_note || 'আপনার আবেদনে কিছু পরিবর্তন দরকার।' : null)
        if (registration?.status !== 'REJECTED' && registration?.document_path) setDocPreviewUrl(await getVerificationDocUrl(registration.document_path))
      } catch (loadError) {
        console.error('Seller verification load failed:', loadError)
        if (active) setStatusLoadError(formatVerificationStatusError(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadRegistration()
    return () => { active = false }
  }, [uid, retryNonce])

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
      void checkShopUsername(normalized).then((result) => {
        if (active) setUsernameState({ status: result.is_available ? 'available' : 'taken', suggestions: result.suggestions })
      }).catch(() => {
        if (active) setUsernameState({ status: 'invalid', suggestions: [] })
      })
    }, 350)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [shopUsername])

  useEffect(() => {
    if (!businessType) return
    setLoadingRequirements(true); setRequirementsError(null); setFiles({})
    const fallback = FALLBACK_REQUIREMENTS_BY_TYPE[businessType]
    getSellerDocumentRequirements(listingMode, businessType, sector).then((data) => setRequirements(data.length ? data : fallback)).catch(() => { setRequirementsError('এই বিক্রেতার ধরনের কাগজপত্রের তালিকা লোড করা যায়নি। নিচের প্রয়োজনীয় কাগজপত্র অনুসরণ করুন।'); setRequirements(fallback) }).finally(() => setLoadingRequirements(false))
  }, [businessType, listingMode, sector])

  const requiredRequirements = useMemo(() => requirements.filter((item) => item.required), [requirements])
  const isValid = !statusLoadError && Boolean(businessType) && fullName.trim().length >= 3 && phone.replace(/\D/g, '').length >= 11 && idNumber.trim().length >= 5 && shopName.trim().length >= 2 && usernameState.status === 'available' && address.trim().length >= 5 && (businessType === 'PERSONAL' || businessName.trim().length >= 2) && requiredRequirements.every((item) => files[item.document_type])

  const chooseBusinessType = (value: BusinessType) => {
    setBusinessType(value)
    navigate(`/become-seller/verify?mode=DIGITAL&businessType=${value}`, { replace: true })
  }

  const handleCameraCapture = (requirement: Requirement, file: File) => {
    const fileError = validateVerificationFile(file)
    if (fileError) {
      setError(fileError)
      return
    }
    setFiles((current) => ({ ...current, [requirement.document_type]: file }))
    setCameraRequirement(null)
    setError(null)
  }

  const handleSubmit = async () => {
    if (!isValid || submitting || !businessType) return
    setSubmitting(true); setError(null)
    try {
      const uploaded = await uploadVerificationDocuments(requiredRequirements.map((item) => ({ documentType: item.document_type, file: files[item.document_type]! })), uid)
      await submitSellerRegistrationV2({ userId: uid, listingMode, businessType, sector, fullName: fullName.trim(), phone: phone.trim(), nidOrBusinessNumber: idNumber.trim(), businessName: businessType === 'PERSONAL' ? null : businessName.trim(), shopName: shopName.trim(), shopUsername: shopUsername.trim(), address: address.trim(), documents: uploaded })
      window.location.reload()
    } catch (err) { console.error('Seller verification submit failed:', err); setError(err instanceof Error ? err.message : 'আবেদন জমা দেওয়া যায়নি। সব তথ্য ও কাগজপত্র পরীক্ষা করুন।'); setSubmitting(false) }
  }

  const returnToForm = (sectionId: string) => {
    setShowReview(false)
    window.requestAnimationFrame(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  if (showReview && businessType) return <Layout wide><div className="mx-auto max-w-4xl pb-20"><section className="mt-5 overflow-hidden rounded-3xl border border-brand-200 bg-surface shadow-sm"><div className="bg-gradient-to-br from-brand-50 via-surface to-emerald-50 px-5 py-6 sm:px-8 sm:py-8"><button type="button" onClick={() => setShowReview(false)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800"><ChevronLeft size={17} />ফর্মে ফিরে যান</button><p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">শেষ ধাপ</p><h1 className="mt-1 text-2xl font-bold text-ink-900 sm:text-3xl">আপনার তথ্য একবার দেখে নিন</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">সব তথ্য ঠিক থাকলে আবেদন জমা দিন। কোনো ভুল থাকলে সংশ্লিষ্ট কার্ডের পেন্সিল আইকনে চাপ দিয়ে ঠিক করে নিন।</p></div></section><div className="mt-5 space-y-4"><ReviewCard title="বিক্রেতার পরিচয়" icon={<ShieldCheck size={19} />} onEdit={() => returnToForm('seller-profile-form')} rows={[['ধরন', businessType === 'PERSONAL' ? 'পারসোনাল' : businessType === 'BUSINESS' ? 'ব্যবসায়িক' : 'কোম্পানি'], ['সেক্টর', SECTORS.find(([value]) => value === sector)?.[1] || sector], ['পূর্ণ নাম', fullName], ['মোবাইল', phone], ['পরিচয় নম্বর', maskSensitive(idNumber)]]} /><ReviewCard title="শপ ও ঠিকানা" icon={<Store size={19} />} onEdit={() => returnToForm('seller-profile-form')} rows={businessType === 'PERSONAL' ? [['শপের নাম', shopName], ['শপ ইউজারনেম', `/${shopUsername}`], ['ঠিকানা', address]] : [['ব্যবসা/কোম্পানির নাম', businessName || '—'], ['শপের নাম', shopName], ['শপ ইউজারনেম', `/${shopUsername}`], ['ঠিকানা', address]]} /><ReviewCard title="জমা দেওয়ার কাগজপত্র" icon={<FileCheck2 size={19} />} onEdit={() => returnToForm('seller-documents-form')} rows={requiredRequirements.map((item) => [item.document_label, files[item.document_type]?.name || 'ফাইল নির্বাচিত হয়নি'])} /><div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 text-sm leading-6 text-ink-700"><div className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-brand-600" size={19} /><p>আমি নিশ্চিত করছি যে উপরের তথ্য আমার নিজের এবং জমা দেওয়া কাগজপত্র সঠিক। BikriKoro-এর অনুমোদিত টিম তথ্যগুলো পর্যালোচনা করবে।</p></div></div>{error && <p className="rounded-xl bg-error/10 p-3 text-sm text-error">{error}</p>}<button type="button" onClick={() => void handleSubmit()} disabled={submitting} className="w-full rounded-xl bg-brand-500 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-wait disabled:opacity-50">{submitting ? 'ডকুমেন্ট নিরাপদে আপলোড হচ্ছে...' : 'তথ্য নিশ্চিত করে আবেদন জমা দিন'}</button><p className="text-center text-xs leading-5 text-ink-400">জমা দেওয়ার পর Admin review শুরু হবে।</p></div></div></Layout>

  if (loading) return <Layout wide><div className="mx-auto max-w-4xl"><div className="h-96 animate-pulse rounded-3xl bg-outline/40" /></div></Layout>
  if (statusLoadError) return <Layout wide><div className="mx-auto max-w-2xl"><section className="mt-5 border border-red-200 bg-surface p-6 sm:p-8"><p className="text-sm font-semibold text-red-700">ভেরিফিকেশন স্ট্যাটাস পাওয়া যায়নি</p><h1 className="mt-2 text-2xl font-bold text-ink-900">আবেদন চালিয়ে যাওয়ার আগে আবার চেষ্টা করুন</h1><p className="mt-3 text-sm leading-6 text-ink-600">{statusLoadError}</p><button type="button" onClick={() => { setLoading(true); setRetryNonce((value) => value + 1) }} className="mt-5 border border-brand-500 bg-brand-500 px-5 py-3 text-base font-semibold text-white hover:bg-brand-600">আবার চেষ্টা করুন</button></section></div></Layout>
  if (existing && existing.status !== 'REJECTED') return <SellerStatusDashboard registration={existing} />
  if (existing) return <Layout wide><div className="mx-auto max-w-4xl"><div className="mt-5 rounded-3xl border border-outline bg-surface p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-ink-500">ভেরিফিকেশন আবেদন</p><h1 className="mt-1 text-2xl font-bold text-ink-900">আপনার আবেদন জমা হয়েছে</h1></div><StatusBadge status={existing.status} /></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="লিস্টিং ধরন" value={existing.listing_mode === 'DIGITAL' ? 'ডিজিটাল' : 'পুরনো রেকর্ড'} /><Info label="সেলার ধরন" value={existing.business_type === 'COMPANY' ? 'কোম্পানি' : existing.business_type === 'BUSINESS' ? 'ব্যবসায়িক' : 'পারসোনাল'} /><Info label="নাম" value={existing.full_name} /><Info label="সেক্টর" value={existing.sector || 'OTHER'} /></div>{docPreviewUrl && <img src={docPreviewUrl} alt="জমা দেওয়া কাগজপত্র" className="mt-5 max-h-52 rounded-xl border border-outline" />}{existing.status === 'REJECTED' && <p className="mt-5 rounded-xl bg-error/10 p-3 text-sm text-error">{existing.admin_note || 'অ্যাডমিনের পর্যালোচনায় পরিবর্তন চাওয়া হয়েছে।'}</p>}<p className="mt-5 text-xs leading-5 text-ink-500">প্রতিটি কাগজপত্র আলাদাভাবে পর্যালোচনা করা হয়। অনুমোদনের পর প্রোফাইলে খাত অনুযায়ী আস্থার ব্যাজ দেখা যাবে।</p></div></div></Layout>

  return <Layout wide><div className="mx-auto max-w-4xl">{previousRejectionNote && <p className="mt-4 rounded-xl bg-error/10 p-3 text-sm leading-6 text-error"><b>আগের আবেদনে পরিবর্তন দরকার ছিল:</b> {previousRejectionNote} এবার সংশোধিত কাগজপত্র দিয়ে আবার জমা দিন।</p>}<section className="mt-4 overflow-hidden rounded-3xl border border-brand-200 bg-surface shadow-sm"><div className="flex items-start gap-3 bg-gradient-to-r from-brand-50 via-surface to-emerald-50 px-5 py-5 sm:px-7 sm:py-6"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white"><ShieldCheck size={23} /></span><div><p className="text-sm font-semibold text-brand-700">ডিজিটাল বিক্রেতা যাচাই</p><h1 className="mt-1 text-2xl font-bold">ধাপে ধাপে আবেদন সম্পন্ন করুন</h1><p className="mt-2 text-sm leading-6 text-ink-600">প্রথমে বিক্রেতার ধরন নির্বাচন করুন। তারপর আপনার ধরন অনুযায়ী যতগুলো কাগজপত্র দরকার, কেবল সেগুলোই দেখানো হবে।</p></div></div></section><div className="mt-5 flex items-center gap-2 text-xs font-semibold text-ink-500"><span className={`rounded-full px-3 py-1 ${businessType ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-700'}`}>১ বিক্রেতার ধরন</span><span className="h-px flex-1 bg-outline" /><span className={`rounded-full px-3 py-1 ${businessType ? 'bg-brand-500 text-white' : 'bg-bg text-ink-400'}`}>২ আপনার কাগজপত্র</span><span className="h-px flex-1 bg-outline" /><span className="rounded-full bg-bg px-3 py-1 text-ink-400">৩ কাগজপত্র</span><span className="h-px flex-1 bg-outline" /><span className={`rounded-full px-3 py-1 ${showReview ? 'bg-brand-500 text-white' : 'bg-bg text-ink-400'}`}>৪ রিভিউ</span></div>{!businessType ? <section className="mt-5 rounded-2xl border border-outline bg-surface p-5 sm:p-7"><h2 className="text-xl font-bold text-ink-900">আপনার বিক্রেতার ধরন নির্বাচন করুন</h2><p className="mt-2 text-sm leading-6 text-ink-600">আপনি কোন পরিচয়ে ডিজিটাল পণ্য বিক্রি করবেন? আপনার পছন্দ অনুযায়ী পরের ধাপে প্রয়োজনীয় কাগজপত্র দেখানো হবে।</p><div className="mt-5 grid gap-3 md:grid-cols-3">{([['PERSONAL', 'পারসোনাল', 'নিজের নামে বিক্রি করবেন', 'NID, সেলফি, ঠিকানা'], ['BUSINESS', 'ব্যবসায়িক', 'ট্রেড লাইসেন্সসহ ব্যবসা', 'NID, ট্রেড লাইসেন্স, e-TIN'], ['COMPANY', 'কোম্পানি', 'নিবন্ধিত কোম্পানি', 'NID, ট্রেড লাইসেন্স, BIN/VAT, নিবন্ধনের কাগজ']] as const).map(([value, title, body, docs]) => <button type="button" key={value} onClick={() => chooseBusinessType(value)} className="group rounded-2xl border border-outline p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-500 hover:bg-brand-50"><span className="flex items-center justify-between"><span className="text-lg font-bold text-ink-900">{title}</span><ArrowRight size={17} className="text-ink-300 group-hover:text-brand-600" /></span><span className="mt-2 block text-sm text-ink-600">{body}</span><span className="mt-4 inline-flex rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-brand-700">প্রয়োজন: {docs}</span></button>)}</div></section> : <div className="mt-5 space-y-5"><section id="seller-profile-form" className="rounded-2xl border border-outline bg-surface p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold text-ink-900">আপনার নির্বাচিত বিক্রেতার ধরন</h2><p className="mt-1 text-sm text-ink-500">{businessType === 'PERSONAL' ? 'পারসোনাল' : businessType === 'BUSINESS' ? 'ব্যবসায়িক' : 'কোম্পানি'}</p></div><button type="button" onClick={() => { setBusinessType(null); navigate('/become-seller/verify?mode=DIGITAL', { replace: true }) }} className="text-xs font-semibold text-brand-700">পরিবর্তন করুন</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><BrandSelect label="সেক্টর" value={sector} options={SECTORS.map(([value, label]) => ({ value, label }))} onChange={setSector} /><Field label="পূর্ণ নাম" value={fullName} onChange={setFullName} placeholder="NID অনুযায়ী নাম" /><Field label="মোবাইল নম্বর" value={phone} onChange={setPhone} placeholder="০১XXXXXXXXX" type="tel" /><Field label={businessType === 'PERSONAL' ? 'NID নম্বর' : 'ট্রেড লাইসেন্স / ব্যবসায়িক নম্বর'} value={idNumber} onChange={setIdNumber} /><Field label="ব্যবসা/কোম্পানির নাম" value={businessName} onChange={setBusinessName} placeholder={businessType === 'PERSONAL' ? 'পারসোনাল হলে প্রয়োজন নেই' : 'রেজিস্টার্ড নাম'} /><div className="sm:col-span-2"><Field label="শপের নাম" value={shopName} onChange={(value) => { setShopName(value); if (!shopUsername) setShopUsername(normalizeShopUsername(value)) }} placeholder="যেমন: Shavora Digital" /></div><div className="sm:col-span-2"><label className="block text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">ইউনিক শপ ইউজারনেম</span><input value={shopUsername} onChange={(event) => setShopUsername(normalizeShopUsername(event.target.value))} maxLength={40} placeholder="যেমন: shavora-digital" className="w-full rounded-xl border border-outline px-3 py-2.5 outline-none focus:border-brand-500" /><span className="mt-1 block text-xs text-ink-500">আপনার শপ লিংক হবে: /seller/{shopUsername || 'your-shop'}</span></label>{usernameState.status === 'checking' && <p className="mt-1 text-xs text-ink-500">ইউজারনেম যাচাই হচ্ছে...</p>}{usernameState.status === 'available' && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-700"><CheckCircle2 size={14} />এই ইউজারনেমটি পাওয়া যাচ্ছে</p>}{usernameState.status === 'taken' && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-error"><XCircle size={14} />এই ইউজারনেম নেওয়া হয়েছে</p>}{usernameState.suggestions.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-xs text-ink-500">প্রস্তাবিত:</span>{usernameState.suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setShopUsername(suggestion)} className="border border-brand-200 bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">{suggestion}</button>)}</div>}</div><div className="sm:col-span-2"><Field label="পূর্ণ ঠিকানা" value={address} onChange={setAddress} placeholder="বাড়ি, রোড, এলাকা, জেলা" /></div></div></section><section id="seller-documents-form" className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-ink-900">আপনার জন্য প্রয়োজনীয় কাগজপত্র</h2><p className="mt-1 text-xs leading-5 text-ink-600">{businessType === 'PERSONAL' ? 'পারসোনাল ডিজিটাল বিক্রেতা হিসেবে পরিচয় ও মালিকানা যাচাই হবে।' : 'আপনার বিক্রেতার ধরন ও খাত অনুযায়ী কাগজপত্র পর্যালোচনা হবে।'} ভুল, সম্পাদিত বা অন্যের কাগজপত্র দিলে আবেদন বাতিল হতে পারে।</p></div><FileCheck2 className="shrink-0 text-brand-600" size={22} /></div>{requirementsError && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{requirementsError}</p>}{loadingRequirements ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-white/70" /> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{requiredRequirements.map((item) => <div key={item.document_type} className="rounded-xl border border-brand-100 bg-white p-3"><span className="flex items-center justify-between gap-2 text-sm font-semibold text-ink-900"><span>{item.document_label}<b className="ml-1 text-error">*</b></span>{files[item.document_type] ? <CheckCircle2 size={17} className="text-brand-600" /> : <Upload size={17} className="text-ink-300" />}</span><span className="mt-1 block text-xs leading-5 text-ink-500">{item.help_text}</span>{['NID_FRONT', 'NID_BACK', 'SELFIE'].includes(item.document_type) && <button type="button" onClick={() => setCameraRequirement(item)} className="mt-2 mr-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"><Camera size={14} />ক্যামেরায় তুলুন</button>}<button type="button" onClick={() => setPreviewDocument(item)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"><Eye size={14} />সহজভাবে দেখুন</button><VerificationDocumentPicker documentType={item.document_type} label={item.document_label} file={files[item.document_type] ?? null} onError={setError} onSelect={(file) => { setError(null); setFiles((current) => ({ ...current, [item.document_type]: file })) }} /></div>)}</div>}</section>{error && <p className="rounded-xl bg-error/10 p-3 text-sm text-error">{error}</p>}<button type="button" onClick={() => setShowReview(true)} disabled={!isValid || submitting} className="w-full rounded-xl bg-brand-500 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">রিভিউ করে আবেদন জমা দিন</button><p className="text-center text-xs leading-5 text-ink-400">আপনার কাগজপত্র গোপনীয় থাকবে এবং কেবল অনুমোদিত অ্যাডমিন পর্যালোচনা করতে পারবেন।</p></div>}</div>{cameraRequirement && <CameraCapture kind={cameraRequirement.document_type === 'SELFIE' ? 'FACE' : 'DOCUMENT'} title={cameraRequirement.document_label} onCapture={(file) => handleCameraCapture(cameraRequirement, file)} onClose={() => setCameraRequirement(null)} />}{previewDocument && <DocumentPreview requirement={previewDocument} onClose={() => setPreviewDocument(null)} />}</Layout>
  }

  function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) { return <label className="block text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-outline px-3 py-2.5 outline-none focus:border-brand-500" /></label> }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-bg p-3"><p className="text-xs text-ink-500">{label}</p><p className="mt-1 text-sm font-semibold text-ink-900">{value}</p></div> }
function StatusBadge({ status }: { status: SellerRegistration['status'] }) { const config = { PENDING: ['পর্যালোচনাধীন', 'bg-warning/10 text-warning'], APPROVED: ['অনুমোদিত ✓', 'bg-brand-100 text-brand-700'], REJECTED: ['পরিবর্তন প্রয়োজন', 'bg-error/10 text-error'] }[status]; return <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{status === 'APPROVED' ? <CheckCircle2 size={14} /> : <ShieldCheck size={14} />}{config[0]}</span> }

function DocumentPreview({ requirement, onClose }: { requirement: Requirement; onClose: () => void }) {
  const guide = getDocumentGuide(requirement.document_type)
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-900/55 p-0 sm:items-center sm:p-5"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold text-brand-700">সহজ নির্দেশনা</p><h2 className="mt-1 text-xl font-bold text-ink-900">{requirement.document_label}</h2></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-ink-500 hover:bg-bg" aria-label="বন্ধ করুন"><X size={20} /></button></div><div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-4"><div className="flex items-center justify-between"><p className="text-sm font-bold text-brand-900">এভাবে ছবি তুলুন</p><span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-brand-700">নমুনা</span></div><div className="mt-3 flex min-h-36 items-center justify-center rounded-2xl border-2 border-dashed border-brand-300 bg-white p-4">{guide.preview}</div></div><p className="mt-4 text-sm leading-6 text-ink-700">{guide.summary}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{guide.tips.map((tip) => <div key={tip} className="rounded-xl bg-bg p-3 text-xs leading-5 text-ink-700"><span className="mr-1 font-bold text-brand-700">✓</span>{tip}</div>)}</div><button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600">বুঝেছি, ছবি আপলোড করব</button></div></div>
}

function getDocumentGuide(documentType: string): { summary: string; tips: string[]; preview: React.ReactNode } {
  if (documentType === 'NID_FRONT') return { summary: 'সামনের দিকের পুরো কার্ডটি একটি ছবিতে রাখুন। ছবি ও লেখা পরিষ্কার থাকবে; চার কোণা বা কোনো অংশ কাটা যাবে না।', tips: ['আলো সামনে থেকে দিন; glare বা ছায়া এড়ান।', 'কার্ডটি সমতল রেখে সোজা ওপর থেকে ছবি তুলুন।', 'ছবি, নাম ও লেখা ঝাপসা হলে আবার ছবি তুলুন।'], preview: <NidGuideCard side="front" /> }
  if (documentType === 'NID_BACK') return { summary: 'পেছনের দিকের পুরো কার্ডটি একটি ছবিতে রাখুন। লেখা এবং QR/barcode অংশ স্পষ্ট থাকবে।', tips: ['QR/barcode ঢাকা, কাটা বা ঝাপসা রাখা যাবে না।', 'আলোতে reflection বা ছায়া এড়িয়ে চলুন।', 'কোনো filter, edit বা screenshot ব্যবহার করবেন না।'], preview: <NidGuideCard side="back" /> }
  if (documentType === 'SELFIE') return { summary: 'নিজের মুখ এবং হাতে ধরা NID একই ছবিতে পরিষ্কার দেখা যেতে হবে।', tips: ['মুখ পুরোপুরি খোলা রাখুন; mask বা sunglasses নয়।', 'NID মুখের সামনে ধরে রাখবেন না।', 'অন্য কাউকে দিয়ে ছবি তুলুন বা timer ব্যবহার করুন।'], preview: <NidSelfieGuideCard /> }
  return { summary: 'এই document-এর সব লেখা ও registration তথ্য যেন একসাথে পরিষ্কার দেখা যায়, এমনভাবে ছবি বা PDF দিন।', tips: ['পুরো document-এর চার কোণা দেখা যাবে।', 'নাম, registration number ও তারিখ পড়া যাবে।', 'পাসওয়ার্ড, OTP বা অপ্রয়োজনীয় গোপন তথ্য upload করবেন না।'], preview: <OwnershipProofGuideCard /> }
}

function maskSensitive(value: string) {
  const compact = value.trim()
  if (compact.length <= 4) return compact ? '••••' : '—'
  return `${compact.slice(0, 2)}${'•'.repeat(Math.max(2, compact.length - 4))}${compact.slice(-2)}`
}

function ReviewCard({ title, icon, rows, onEdit }: { title: string; icon: ReactNode; rows: string[][]; onEdit: () => void }) {
  return <section className="rounded-2xl border border-outline bg-surface p-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)] sm:p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</span><h2 className="font-bold text-ink-900">{title}</h2></div><button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-brand-50" aria-label={`${title} সম্পাদনা করুন`}><Pencil size={14} />এডিট</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{rows.map(([label, value], index) => <div key={`${label}-${index}`} className="rounded-xl bg-bg px-3 py-2.5"><p className="text-[11px] font-medium text-ink-500">{label}</p><p className="mt-0.5 break-words text-sm font-semibold text-ink-900">{value || '—'}</p></div>)}</div></section>
}

function SellerStatusDashboard({ registration }: { registration: SellerRegistration }) {
  const approved = registration.status === 'APPROVED'
  const statusLabel = approved ? 'সেলার অ্যাকাউন্ট অনুমোদিত' : 'আবেদন পর্যালোচনাধীন'
  const statusBody = approved ? 'আপনার তথ্য যাচাই সম্পন্ন হয়েছে। এখন আপনার seller dashboard থেকে পণ্য যোগ করে বিক্রি শুরু করতে পারবেন।' : 'আপনার আবেদন নিরাপদে জমা হয়েছে। Admin team আপনার তথ্য ও documents যাচাই করছে। অনুমোদন হলে আপনার seller tools স্বয়ংক্রিয়ভাবে চালু হবে।'
  return <Layout wide><div className="mx-auto max-w-4xl pb-20"><section className={`mt-5 overflow-hidden rounded-3xl border shadow-sm ${approved ? 'border-brand-200' : 'border-amber-200'}`}><div className={`relative px-5 py-8 sm:px-9 sm:py-10 ${approved ? 'bg-gradient-to-br from-brand-50 via-surface to-emerald-100' : 'bg-gradient-to-br from-amber-50 via-surface to-brand-50'}`}><div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/60 blur-2xl" /><div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center"><span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${approved ? 'bg-brand-500 text-white' : 'bg-amber-100 text-amber-700'}`}>{approved ? <CheckCircle2 size={32} /> : <Clock3 size={32} />}</span><div><p className={`text-sm font-bold ${approved ? 'text-brand-700' : 'text-amber-700'}`}>{approved ? 'অভিনন্দন' : 'BikriKoro seller review'}</p><h1 className="mt-1 text-2xl font-bold text-ink-900 sm:text-3xl">{statusLabel}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-700">{statusBody}</p></div></div></div><div className="grid gap-3 border-t border-white/70 bg-surface p-4 sm:grid-cols-3 sm:p-5"><StatusStep number="১" title="আবেদন জমা" done /><StatusStep number="২" title="Admin review" done={approved} active={!approved} /><StatusStep number="৩" title="সেলার tools" done={approved} /></div></section><section className="mt-5 grid gap-4 md:grid-cols-[1.15fr_0.85fr]"><div className="rounded-2xl border border-outline bg-surface p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><FileCheck2 className="text-brand-600" size={20} /><h2 className="font-bold text-ink-900">আবেদনের সারাংশ</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="নাম" value={registration.full_name} /><Info label="সেলার ধরন" value={registration.business_type === 'COMPANY' ? 'কোম্পানি' : registration.business_type === 'BUSINESS' ? 'ব্যবসায়িক' : 'পারসোনাল'} /><Info label="লিস্টিং ধরন" value={registration.listing_mode === 'DIGITAL' ? 'ডিজিটাল পণ্য' : 'ফিজিক্যাল পণ্য'} /><Info label="সেক্টর" value={registration.sector || 'OTHER'} /></div></div><div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-5 sm:p-6"><h2 className="font-bold text-ink-900">এখন কী করবেন?</h2><p className="mt-2 text-sm leading-6 text-ink-700">{approved ? 'আপনার প্রথম product draft তৈরি করে listing শুরু করুন।' : 'Review শেষ হওয়া পর্যন্ত অপেক্ষা করুন। প্রয়োজনে status দেখতে এই পেজে ফিরে আসুন।'}</p>{approved ? <Link to="/seller/dashboard" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Seller dashboard খুলুন <ArrowRight size={16} /></Link> : <Link to="/account" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm font-bold text-brand-700 transition hover:bg-brand-50">আমার Profile দেখুন <ArrowRight size={16} /></Link>}</div></section><p className="mt-5 text-center text-xs leading-5 text-ink-400">আপনার sensitive documents কেবল অনুমোদিত review team দেখতে পারবে।</p></div></Layout>
}

function StatusStep({ number, title, done, active = false }: { number: string; title: string; done: boolean; active?: boolean }) {
  return <div className="flex items-center gap-3 rounded-xl bg-bg/70 p-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-brand-500 text-white' : active ? 'bg-amber-100 text-amber-700' : 'bg-outline text-ink-500'}`}>{done ? '✓' : number}</span><span className={`text-sm font-semibold ${done || active ? 'text-ink-900' : 'text-ink-500'}`}>{title}</span></div>
}
