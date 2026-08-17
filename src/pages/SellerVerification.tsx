import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, FileCheck2, ShieldCheck, Upload } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { supabase } from '@/lib/supabase'
import { getSellerDocumentRequirements, getVerificationDocUrl, submitSellerRegistrationV2, uploadVerificationDocuments } from '@/lib/verification'
import type { BusinessType, ListingMode, SellerRegistration } from '@/types/chat'

type Requirement = { document_type: string; document_label: string; help_text: string; required: boolean; sort_order: number }
const SECTORS = [['SOFTWARE', 'Software / SaaS'], ['EDUCATION', 'Education / Course'], ['CREATIVE', 'Creative / Media'], ['RETAIL', 'Retail / Reseller'], ['SERVICES', 'Professional Services'], ['OTHER', 'অন্যান্য']] as const
const FALLBACK_REQUIREMENTS: Requirement[] = [
  { document_type: 'NID_FRONT', document_label: 'NID-এর সামনের অংশ', help_text: 'পরিষ্কার ও সম্পূর্ণ ছবি দিন।', required: true, sort_order: 10 },
  { document_type: 'NID_BACK', document_label: 'NID-এর পেছনের অংশ', help_text: 'লেখা ও QR/বারকোড যেন বোঝা যায়।', required: true, sort_order: 20 },
  { document_type: 'SELFIE', document_label: 'NID হাতে selfie', help_text: 'মুখ ও NID দুটোই পরিষ্কার দেখা যেতে হবে।', required: true, sort_order: 30 },
]

export default function SellerVerification() {
  const { user } = useAuth()
  const uid = user!.uid
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const modeFromUrl = searchParams.get('mode') === 'PHYSICAL' ? 'PHYSICAL' : 'DIGITAL'
  const businessTypeFromUrl = searchParams.get('businessType') as BusinessType | null
  const [existing, setExisting] = useState<SellerRegistration | null>(null)
  const [docPreviewUrl, setDocPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingRequirements, setLoadingRequirements] = useState(false)
  const [requirementsError, setRequirementsError] = useState<string | null>(null)
  const [requirements, setRequirements] = useState<Requirement[]>(FALLBACK_REQUIREMENTS)
  const [listingMode] = useState<ListingMode>(modeFromUrl)
  const [businessType, setBusinessType] = useState<BusinessType | null>(businessTypeFromUrl && ['PERSONAL', 'BUSINESS', 'COMPANY'].includes(businessTypeFromUrl) ? businessTypeFromUrl : null)
  const [sector, setSector] = useState('OTHER')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [address, setAddress] = useState('')
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('seller_registrations').select('*').eq('user_id', uid).order('submitted_at', { ascending: false }).limit(1).maybeSingle().then(async ({ data }) => {
      setExisting(data)
      if (data?.document_path) setDocPreviewUrl(await getVerificationDocUrl(data.document_path))
      setLoading(false)
    })
  }, [uid])

  useEffect(() => {
    if (!businessType) return
    setLoadingRequirements(true); setRequirementsError(null); setFiles({})
    getSellerDocumentRequirements(listingMode, businessType, sector).then((data) => setRequirements(data.length ? data : FALLBACK_REQUIREMENTS)).catch(() => { setRequirementsError('Document checklist এখনো server থেকে আসেনি। Migration 023 না চলা পর্যন্ত basic checklist দেখানো হচ্ছে।'); setRequirements(FALLBACK_REQUIREMENTS) }).finally(() => setLoadingRequirements(false))
  }, [businessType, listingMode, sector])

  const requiredRequirements = useMemo(() => requirements.filter((item) => item.required), [requirements])
  const isValid = Boolean(businessType) && fullName.trim().length >= 3 && phone.replace(/\D/g, '').length >= 11 && idNumber.trim().length >= 5 && address.trim().length >= 5 && (businessType === 'PERSONAL' || businessName.trim().length >= 2) && requiredRequirements.every((item) => files[item.document_type])

  const chooseBusinessType = (value: BusinessType) => {
    setBusinessType(value)
    navigate(`/become-seller/verify?mode=DIGITAL&businessType=${value}`, { replace: true })
  }

  const handleSubmit = async () => {
    if (!isValid || submitting || !businessType) return
    setSubmitting(true); setError(null)
    try {
      const uploaded = await uploadVerificationDocuments(requiredRequirements.map((item) => ({ documentType: item.document_type, file: files[item.document_type]! })), uid)
      await submitSellerRegistrationV2({ userId: uid, listingMode, businessType, sector, fullName: fullName.trim(), phone: phone.trim(), nidOrBusinessNumber: idNumber.trim(), businessName: businessType === 'PERSONAL' ? null : businessName.trim(), address: address.trim(), documents: uploaded })
      window.location.reload()
    } catch (err) { console.error('Seller verification submit failed:', err); setError(err instanceof Error ? err.message : 'আবেদন জমা দেওয়া যায়নি। সব তথ্য ও document পরীক্ষা করুন।'); setSubmitting(false) }
  }

  if (loading) return <Layout wide><div className="mx-auto max-w-4xl"><div className="h-96 animate-pulse rounded-3xl bg-outline/40" /></div></Layout>
  if (existing) return <Layout wide><div className="mx-auto max-w-4xl"><Link to="/become-seller" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft size={16} />Seller page-এ ফিরুন</Link><div className="mt-5 rounded-3xl border border-outline bg-surface p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-ink-500">Verification application</p><h1 className="mt-1 text-2xl font-bold text-ink-900">আপনার আবেদন জমা হয়েছে</h1></div><StatusBadge status={existing.status} /></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Listing mode" value={existing.listing_mode === 'DIGITAL' ? 'ডিজিটাল' : 'ফিজিক্যাল'} /><Info label="Seller type" value={existing.business_type === 'COMPANY' ? 'কোম্পানি' : existing.business_type === 'BUSINESS' ? 'ব্যবসায়িক' : 'পারসোনাল'} /><Info label="নাম" value={existing.full_name} /><Info label="Sector" value={existing.sector || 'OTHER'} /></div>{docPreviewUrl && <img src={docPreviewUrl} alt="জমা দেওয়া document" className="mt-5 max-h-52 rounded-xl border border-outline" />}{existing.status === 'REJECTED' && <p className="mt-5 rounded-xl bg-error/10 p-3 text-sm text-error">{existing.admin_note || 'Admin review থেকে পরিবর্তন চাওয়া হয়েছে।'}</p>}<p className="mt-5 text-xs leading-5 text-ink-500">প্রতিটি document আলাদাভাবে review করা হয়। অনুমোদনের পর profile-এ sector অনুযায়ী trust badge দেখা যাবে।</p></div></div></Layout>

  return <Layout wide><div className="mx-auto max-w-4xl"><Link to="/become-seller" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft size={16} />Seller type বাছাইয়ে ফিরুন</Link><section className="mt-4 rounded-3xl bg-ink-900 p-5 text-white sm:p-7"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-brand-300" size={25} /><div><p className="text-sm font-semibold text-brand-300">ডিজিটাল seller verification</p><h1 className="mt-1 text-2xl font-bold">ধাপে ধাপে আবেদন সম্পন্ন করুন</h1><p className="mt-2 text-sm leading-6 text-white/70">প্রথমে seller type নির্বাচন করুন। তারপর আপনার type অনুযায়ী ঠিক যতগুলো document দরকার, কেবল সেগুলোই দেখানো হবে।</p></div></div></section><div className="mt-5 flex items-center gap-2 text-xs font-semibold text-ink-500"><span className={`rounded-full px-3 py-1 ${businessType ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-700'}`}>১ Seller type</span><span className="h-px flex-1 bg-outline" /><span className={`rounded-full px-3 py-1 ${businessType ? 'bg-brand-500 text-white' : 'bg-bg text-ink-400'}`}>২ আপনার documents</span><span className="h-px flex-1 bg-outline" /><span className="rounded-full bg-bg px-3 py-1 text-ink-400">৩ Submit</span></div>{!businessType ? <section className="mt-5 rounded-2xl border border-outline bg-surface p-5 sm:p-7"><h2 className="text-xl font-bold text-ink-900">আপনার seller type নির্বাচন করুন</h2><p className="mt-2 text-sm leading-6 text-ink-600">আপনি কোন পরিচয়ে ডিজিটাল পণ্য বিক্রি করবেন? আপনার selection অনুযায়ী পরের ধাপে required documents দেখানো হবে।</p><div className="mt-5 grid gap-3 md:grid-cols-3">{([['PERSONAL', 'পারসোনাল', 'নিজের নামে বিক্রি করবেন', 'NID, selfie, address'], ['BUSINESS', 'ব্যবসায়িক', 'Trade license-সহ ব্যবসা', 'NID, trade license, e-TIN'], ['COMPANY', 'কোম্পানি', 'Registered company', 'NID, trade license, BIN/VAT, registration']] as const).map(([value, title, body, docs]) => <button key={value} onClick={() => chooseBusinessType(value)} className="group rounded-2xl border border-outline p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-500 hover:bg-brand-50"><span className="flex items-center justify-between"><span className="text-lg font-bold text-ink-900">{title}</span><ArrowRight size={17} className="text-ink-300 group-hover:text-brand-600" /></span><span className="mt-2 block text-sm text-ink-600">{body}</span><span className="mt-4 inline-flex rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-brand-700">প্রয়োজন: {docs}</span></button>)}</div></section> : <div className="mt-5 space-y-5"><section className="rounded-2xl border border-outline bg-surface p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold text-ink-900">আপনার নির্বাচিত seller type</h2><p className="mt-1 text-sm text-ink-500">{businessType === 'PERSONAL' ? 'পারসোনাল' : businessType === 'BUSINESS' ? 'ব্যবসায়িক' : 'কোম্পানি'}</p></div><button onClick={() => { setBusinessType(null); navigate('/become-seller/verify?mode=DIGITAL', { replace: true }) }} className="text-xs font-semibold text-brand-700">পরিবর্তন করুন</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">Sector</span><select value={sector} onChange={(e) => setSector(e.target.value)} className="w-full rounded-xl border border-outline bg-surface px-3 py-2.5 outline-none focus:border-brand-500">{SECTORS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><Field label="পূর্ণ নাম" value={fullName} onChange={setFullName} placeholder="NID অনুযায়ী নাম" /><Field label="মোবাইল নম্বর" value={phone} onChange={setPhone} placeholder="০১XXXXXXXXX" type="tel" /><Field label={businessType === 'PERSONAL' ? 'NID নম্বর' : 'Trade license / business number'} value={idNumber} onChange={setIdNumber} /><Field label="ব্যবসা/কোম্পানির নাম" value={businessName} onChange={setBusinessName} placeholder={businessType === 'PERSONAL' ? 'পারসোনাল হলে প্রয়োজন নেই' : 'রেজিস্টার্ড নাম'} /><div className="sm:col-span-2"><Field label="পূর্ণ ঠিকানা" value={address} onChange={setAddress} placeholder="বাড়ি, রোড, এলাকা, জেলা" /></div></div></section><section className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-ink-900">আপনার জন্য প্রয়োজনীয় documents</h2><p className="mt-1 text-xs leading-5 text-ink-600">{businessType === 'PERSONAL' ? 'পারসোনাল digital seller হিসেবে identity ও ownership যাচাই হবে।' : 'আপনার seller type ও sector অনুযায়ী documents review হবে।'} ভুল, edited বা অন্যের document দিলে আবেদন বাতিল হতে পারে।</p></div><FileCheck2 className="shrink-0 text-brand-600" size={22} /></div>{requirementsError && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{requirementsError}</p>}{loadingRequirements ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-white/70" /> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{requiredRequirements.map((item) => <label key={item.document_type} className="block rounded-xl border border-brand-100 bg-white p-3"><span className="flex items-center justify-between gap-2 text-sm font-semibold text-ink-900"><span>{item.document_label}<b className="ml-1 text-error">*</b></span>{files[item.document_type] ? <CheckCircle2 size={17} className="text-brand-600" /> : <Upload size={17} className="text-ink-300" />}</span><span className="mt-1 block text-xs leading-5 text-ink-500">{item.help_text}</span><input type="file" accept="image/*,.pdf" onChange={(e) => setFiles((current) => ({ ...current, [item.document_type]: e.target.files?.[0] ?? null }))} className="mt-2 w-full text-xs text-ink-600" />{files[item.document_type] && <span className="mt-1 block truncate text-xs text-brand-700">{files[item.document_type]?.name}</span>}</label>)}</div>}</section>{error && <p className="rounded-xl bg-error/10 p-3 text-sm text-error">{error}</p>}<button onClick={handleSubmit} disabled={!isValid || submitting} className="w-full rounded-xl bg-brand-500 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Documents secure upload হচ্ছে...' : 'Verification application জমা দিন'}</button><p className="text-center text-xs leading-5 text-ink-400">আপনার documents private থাকবে এবং কেবল authorized admin review করতে পারবেন।</p></div>}</div></Layout>
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) { return <label className="block text-sm text-ink-700"><span className="mb-1.5 block font-medium text-ink-900">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-outline px-3 py-2.5 outline-none focus:border-brand-500" /></label> }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-bg p-3"><p className="text-xs text-ink-500">{label}</p><p className="mt-1 text-sm font-semibold text-ink-900">{value}</p></div> }
function StatusBadge({ status }: { status: SellerRegistration['status'] }) { const config = { PENDING: ['পর্যালোচনাধীন', 'bg-warning/10 text-warning'], APPROVED: ['অনুমোদিত ✓', 'bg-brand-100 text-brand-700'], REJECTED: ['পরিবর্তন প্রয়োজন', 'bg-error/10 text-error'] }[status]; return <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{status === 'APPROVED' ? <CheckCircle2 size={14} /> : <ShieldCheck size={14} />}{config[0]}</span> }
