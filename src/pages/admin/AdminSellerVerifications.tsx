import { useCallback, useEffect, useState } from 'react'
import { Check, CheckCircle2, ChevronDown, Eye, FileCheck2, FileText, Image as ImageIcon, Link as LinkIcon, X, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { auth } from '@/lib/firebase'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { useAuth } from '@/context/AuthContext'
import { AdminShell, AdminPageHeader, AdminTableCard } from '@/components/admin/AdminShell'
import { formatDateTime } from '@/lib/format'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import type { SellerRegistration, SellerVerificationDocument } from '@/types/chat'
import { adminRpc } from '@/lib/adminRpc'

type RegistrationDocument = SellerVerificationDocument & { document_url?: string | null }
type SellerProfileSummary = { id: string; name: string | null; photo_url: string | null }
type RegistrationWithDocuments = SellerRegistration & { documents: RegistrationDocument[]; seller_profile?: SellerProfileSummary | null }
type SellerReviewHistory = { registration_id: string; applicant_name: string; applicant_user_id: string; admin_uid: string; admin_email: string; admin_name: string; action: string; document_type: string | null; note: string; created_at: string }

type ReviewStatus = SellerVerificationDocument['status']
type ReviewAction = 'APPROVED' | 'REJECTED'

export default function AdminSellerVerifications() {
  const { user } = useAuth()
  const adminId = user!.uid
  const [registrations, setRegistrations] = useState<RegistrationWithDocuments[]>([])
  const [docUrls, setDocUrls] = useState<Record<string, string>>({})
  const [noteById, setNoteById] = useState<Record<string, string>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [previewDocument, setPreviewDocument] = useState<RegistrationDocument | null>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [reviewHistory, setReviewHistory] = useState<SellerReviewHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setHistoryLoading(true)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('Admin Firebase session পাওয়া যায়নি।')
      const response = await fetch('/api/admin-seller-verifications', { headers: { Authorization: `Bearer ${idToken}` } })
      const payload = await response.json().catch(() => ({})) as { error?: string; registrations?: RegistrationWithDocuments[]; history?: SellerReviewHistory[] }
      if (!response.ok) throw new Error(payload.error || `Seller verification load failed (HTTP ${response.status})`)
      const rows = payload.registrations ?? []
      const urls = Object.fromEntries(rows.flatMap((row) => row.documents.map((document) => document.document_url ? [document.id, document.document_url] as const : null).filter((entry): entry is readonly [string, string] => Boolean(entry))))
      setRegistrations(rows)
      setDocUrls(urls)
      setReviewHistory(payload.history ?? [])
      setExpandedId((current) => current && rows.some((row) => row.id === current) ? current : null)
    } catch (error) {
      console.error('Admin seller verification load failed:', error)
      setNotice(error instanceof Error ? error.message : 'Seller verification data লোড করা যায়নি।')
      setRegistrations([])
      setReviewHistory([])
    } finally {
      setHistoryLoading(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const reviewDocument = async (documentId: string, status: ReviewAction) => {
    setProcessingId(documentId)
    const { error } = await adminRpc('admin_review_verification_document', { p_admin_id: adminId, p_document_id: documentId, p_status: status, p_admin_note: noteById[documentId]?.trim() || '' })
    if (error) setNotice(formatAdminRpcError(error, 'Verification document review', '031 admin approval migration'))
    else setRegistrations((current) => current.map((registration) => ({ ...registration, documents: registration.documents.map((document) => document.id === documentId ? { ...document, status, admin_note: noteById[documentId]?.trim() || '', reviewed_by: adminId, reviewed_at: new Date().toISOString() } : document) })))
    setProcessingId(null)
  }

  const finalize = async (registrationId: string, status: ReviewAction) => {
    setProcessingId(registrationId)
    const { error } = await adminRpc('admin_finalize_seller_verification', { p_admin_id: adminId, p_registration_id: registrationId, p_status: status, p_admin_note: noteById[registrationId]?.trim() || '' })
    if (error) setNotice(error.message.includes('required documents') ? 'সব required document আগে approve করুন।' : formatAdminRpcError(error, 'Seller application review', '031 admin approval migration'))
    else {
      setRegistrations((current) => current.filter((registration) => registration.id !== registrationId))
      setExpandedId((current) => current === registrationId ? null : current)
    }
    setProcessingId(null)
  }

  return (
    <AdminShell>
      <AdminPageHeader title="সেলার ভেরিফিকেশন রিভিউ" description="একটি আবেদন বেছে নিয়ে বিস্তারিত document review ও final decision দিন।" />
      <div className="mb-5 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-brand-800">
        <FileCheck2 className="mr-2 inline-block align-text-bottom" size={17} />
        Approved seller-এর profile-এ mode ও sector অনুযায়ী trust badge তৈরি হবে। Sensitive documents public করা হয় না।
      </div>

      {loading ? <AdminTableCard><p className="p-10 text-center text-sm text-slate-500">আবেদন লোড হচ্ছে...</p></AdminTableCard> : registrations.length === 0 ? <AdminTableCard><p className="p-10 text-center text-sm text-slate-500">অনুমোদনের অপেক্ষায় কোনো আবেদন নেই।</p></AdminTableCard> : (
        <div className="space-y-3">
          {registrations.map((registration) => {
            const approvedCount = registration.documents.filter((document) => document.status === 'APPROVED').length
            const pendingCount = registration.documents.filter((document) => document.status === 'PENDING').length
            const allDocumentsApproved = registration.documents.length > 0 && registration.documents.every((document) => document.status === 'APPROVED')
            const expanded = expandedId === registration.id
            return (
              <AdminTableCard key={registration.id} className="transition-shadow hover:shadow-md">
                <button type="button" aria-expanded={expanded} onClick={() => setExpandedId((current) => current === registration.id ? null : registration.id)} className="w-full px-4 py-4 text-left transition hover:bg-bg/60 sm:px-5">
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><FileText size={19} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-slate-900">{registration.full_name}</span>
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">{pendingCount}টি pending</span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500">{registration.listing_mode === 'DIGITAL' ? 'ডিজিটাল' : 'ফিজিক্যাল'} · {registration.business_type ?? 'PERSONAL'} · {registration.sector ?? 'OTHER'}</span>
                      <span className="mt-1 block text-[11px] text-slate-400">জমা: {formatDateTime(registration.submitted_at)}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 sm:inline-flex">{approvedCount}/{registration.documents.length} approved</span>
                      <ChevronDown size={18} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </span>
                  </span>
                </button>

                {expanded && <div className="border-t border-slate-200">
                  <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                    <Info label="ফোন" value={registration.phone} />
                    <Info label="NID/Business no." value={registration.nid_or_business_number} />
                    <Info label="ব্যবসার নাম" value={registration.business_name || 'প্রযোজ্য নয়'} />
                    <Info label="ঠিকানা" value={registration.address} />
                  </div>

                  <div className="px-4 pb-4 sm:px-5">
                    <SellerShopImageCard profile={registration.seller_profile} onPreview={(url, name) => setPreviewImage({ url, name })} />
                  </div>

                  <div className="border-t border-slate-200 px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-slate-900">জমা দেওয়া documents</h3>
                        <p className="mt-1 text-xs text-slate-500">প্রতিটি document খুলে দেখে approve বা reject করুন।</p>
                      </div>
                      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{approvedCount}/{registration.documents.length} approved</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {registration.documents.map((document) => <DocumentReviewCard key={document.id} document={document} documentUrl={docUrls[document.id]} note={noteById[document.id] ?? ''} processing={processingId === document.id} onNoteChange={(value) => setNoteById((current) => ({ ...current, [document.id]: value }))} onPreview={() => setPreviewDocument(document)} onReview={(status) => reviewDocument(document.id, status)} />)}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                    <p className="mb-2 text-xs font-semibold text-slate-600">Final application decision</p>
                    {!allDocumentsApproved && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Final approve করার আগে সব document-এ Approve দিতে হবে।</p>}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <textarea value={noteById[registration.id] ?? ''} onChange={(e) => setNoteById((current) => ({ ...current, [registration.id]: e.target.value }))} rows={2} placeholder="Final review note" className="min-h-20 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500" />
                      <div className="flex gap-2 sm:pb-0.5">
                        <button type="button" onClick={() => finalize(registration.id, 'APPROVED')} disabled={processingId === registration.id || !allDocumentsApproved} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Check size={15} />Final approve</button>
                        <button type="button" onClick={() => finalize(registration.id, 'REJECTED')} disabled={processingId === registration.id} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50"><X size={15} />Reject</button>
                      </div>
                    </div>
                  </div>
                </div>}
              </AdminTableCard>
            )
          })}
        </div>
      )}

      <AdminTableCard className="mt-5">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Seller approval history</h2><p className="mt-1 text-xs text-slate-500">কে কোন seller বা document approve/reject করেছে, তার Gmail ও UID এখানে থাকবে।</p></div>
        {historyLoading ? <p className="p-6 text-sm text-slate-500">History লোড হচ্ছে...</p> : reviewHistory.length === 0 ? <p className="p-6 text-sm text-slate-500">এখনো কোনো seller approval history নেই।</p> : <div className="divide-y divide-slate-100">{reviewHistory.map((entry) => <div key={`${entry.registration_id}-${entry.created_at}-${entry.admin_uid}`} className="grid gap-2 px-5 py-4 md:grid-cols-[1fr_1fr_1fr_1.2fr]"><div><p className="font-semibold text-slate-800">{entry.applicant_name}</p><p className="text-xs text-slate-400">{entry.applicant_user_id}</p></div><div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${entry.action.includes('APPROVED') ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>{entry.action}</span><p className="mt-1 text-xs text-slate-500">{entry.document_type || 'Final application'}</p></div><div><p className="text-xs font-semibold text-slate-700">{entry.admin_email || 'ইমেইল নেই'}</p><p className="break-all text-[10px] text-slate-400">UID: {entry.admin_uid}</p></div><div><p className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</p>{entry.note && <p className="mt-1 text-xs text-slate-600">{entry.note}</p>}</div></div>)}</div>}
      </AdminTableCard>

      <Link to="/admin" className="mt-5 inline-flex text-sm font-semibold text-brand-700">← Admin dashboard</Link>
      {previewDocument && <DocumentPreviewDialog reviewDocument={previewDocument} documentUrl={docUrls[previewDocument.id]} onClose={() => setPreviewDocument(null)} />}
      {previewImage && <ImagePreviewDialog image={previewImage} onClose={() => setPreviewImage(null)} />}
      <BrandedDialog open={Boolean(notice)} title="Verification update" onClose={() => setNotice(null)} actions={<DialogButton onClick={() => setNotice(null)}>ঠিক আছে</DialogButton>}><p>{notice}</p></BrandedDialog>
    </AdminShell>
  )
}

function SellerShopImageCard({ profile, onPreview }: { profile?: SellerProfileSummary | null; onPreview: (url: string, name: string) => void }) {
  const photoUrl = profile?.photo_url ?? ''
  const sellerName = profile?.name || 'এই সেলার'
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-100 text-brand-700">
      {photoUrl ? <img src={photoUrl} alt={`${sellerName}-এর shop image`} className="h-full w-full object-cover" /> : <ImageIcon size={22} />}
    </div>
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-slate-800">Seller / shop image</p><p className="mt-1 text-xs text-slate-500">{photoUrl ? 'প্রোফাইল থেকে পাওয়া image' : 'এই সেলার এখনো কোনো shop image দেননি।'}</p></div>
    {photoUrl ? <button type="button" onClick={() => onPreview(photoUrl, `${sellerName}-এর shop image`)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-brand-50"><Eye size={13} />ছবি দেখুন</button> : <span className="shrink-0 text-[11px] text-slate-400">ছবি নেই</span>}
  </div>
}

function DocumentReviewCard({ document, documentUrl, note, processing, onNoteChange, onPreview, onReview }: { document: RegistrationDocument; documentUrl?: string; note: string; processing: boolean; onNoteChange: (value: string) => void; onPreview: () => void; onReview: (status: ReviewAction) => void }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">{formatDocumentType(document.document_type)}</p>
        <StatusPill status={document.status} />
      </div>
      {documentUrl ? <button type="button" onClick={onPreview} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"><Eye size={13} />দেখুন</button> : <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><LinkIcon size={12} />লিংক নেই</span>}
    </div>
    <textarea value={note} onChange={(event) => onNoteChange(event.target.value)} rows={1} placeholder="Document review note" className="mt-3 min-h-9 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500" />
    <div className="mt-2 flex gap-2">
      <button type="button" onClick={() => onReview('APPROVED')} disabled={processing} className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Check size={13} />Approve</button>
      <button type="button" onClick={() => onReview('REJECTED')} disabled={processing} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"><X size={13} />Reject</button>
    </div>
  </div>
}

function StatusPill({ status }: { status: ReviewStatus }) {
  const style = status === 'APPROVED' ? 'bg-brand-50 text-brand-700' : status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
  const Icon = status === 'APPROVED' ? CheckCircle2 : status === 'REJECTED' ? XCircle : FileCheck2
  return <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${style}`}><Icon size={12} />{status}</span>
}

function DocumentPreviewDialog({ reviewDocument, documentUrl, onClose }: { reviewDocument: RegistrationDocument; documentUrl?: string; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!documentUrl) return null
  const sourcePath = documentUrl.split('?')[0].toLowerCase()
  const isPdf = sourcePath.endsWith('.pdf')
  const isImage = /\.(png|jpe?g|webp|gif|bmp)$/i.test(sourcePath)

  return <div className="fixed inset-0 z-[75] flex items-center justify-center bg-ink-900/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`${formatDocumentType(reviewDocument.document_type)} document`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-surface shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-outline px-4 py-3 sm:px-5">
        <div className="min-w-0"><h2 className="truncate font-semibold text-ink-900">{formatDocumentType(reviewDocument.document_type)}</h2><p className="mt-0.5 text-xs text-ink-500">Document preview · {reviewDocument.status}</p></div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-ink-400 transition hover:bg-bg hover:text-ink-700" aria-label="বন্ধ করুন"><X size={20} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-ink-900/5 p-3 sm:p-5">
        {isPdf ? <iframe title={`${formatDocumentType(reviewDocument.document_type)} PDF`} src={documentUrl} className="h-[72vh] min-h-[420px] w-full rounded-xl border border-outline bg-white" /> : isImage ? <img src={documentUrl} alt={`${formatDocumentType(reviewDocument.document_type)} document`} className="mx-auto max-h-[75vh] max-w-full rounded-xl object-contain shadow-sm" /> : <iframe title={`${formatDocumentType(reviewDocument.document_type)} file`} src={documentUrl} className="h-[72vh] min-h-[420px] w-full rounded-xl border border-outline bg-white" />}
      </div>
    </div>
  </div>
}

function ImagePreviewDialog({ image, onClose }: { image: { url: string; name: string }; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return <div className="fixed inset-0 z-[75] flex items-center justify-center bg-ink-900/70 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={image.name} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-surface shadow-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-outline px-4 py-3 sm:px-5"><h2 className="truncate font-semibold text-ink-900">{image.name}</h2><button type="button" onClick={onClose} className="rounded-xl p-2 text-ink-400 transition hover:bg-bg hover:text-ink-700" aria-label="বন্ধ করুন"><X size={20} /></button></div>
      <div className="overflow-auto bg-ink-900/5 p-3 sm:p-5"><img src={image.url} alt={image.name} className="mx-auto max-h-[78vh] max-w-full rounded-xl object-contain shadow-sm" /></div>
    </div>
  </div>
}

function formatDocumentType(value: string) { return value.replace(/_/g, ' ') }

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div> }
