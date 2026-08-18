import { useCallback, useEffect, useState } from 'react'
import { Check, CheckCircle2, FileCheck2, Link as LinkIcon, X, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/firebase'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { useAuth } from '@/context/AuthContext'
import { AdminShell, AdminPageHeader, AdminTableCard } from '@/components/admin/AdminShell'
import { formatDateTime } from '@/lib/format'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import type { SellerRegistration, SellerVerificationDocument } from '@/types/chat'

type RegistrationWithDocuments = SellerRegistration & { documents: Array<SellerVerificationDocument & { document_url?: string | null }> }
type SellerReviewHistory = { registration_id: string; applicant_name: string; applicant_user_id: string; admin_uid: string; admin_email: string; admin_name: string; action: string; document_type: string | null; note: string; created_at: string }

export default function AdminSellerVerifications() {
  const { user } = useAuth()
  const adminId = user!.uid
  const [registrations, setRegistrations] = useState<RegistrationWithDocuments[]>([])
  const [docUrls, setDocUrls] = useState<Record<string, string>>({})
  const [noteById, setNoteById] = useState<Record<string, string>>({})
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
  const reviewDocument = async (documentId: string, status: 'APPROVED' | 'REJECTED') => { setProcessingId(documentId); const { error } = await supabase.rpc('admin_review_verification_document', { p_admin_id: adminId, p_document_id: documentId, p_status: status, p_admin_note: noteById[documentId]?.trim() || '' }); if (error) setNotice(formatAdminRpcError(error, 'Verification document review', '031 admin approval migration')); else await load(); setProcessingId(null) }
  const finalize = async (registrationId: string, status: 'APPROVED' | 'REJECTED') => { setProcessingId(registrationId); const { error } = await supabase.rpc('admin_finalize_seller_verification', { p_admin_id: adminId, p_registration_id: registrationId, p_status: status, p_admin_note: noteById[registrationId]?.trim() || '' }); if (error) setNotice(error.message.includes('required documents') ? 'সব required document আগে approve করুন।' : formatAdminRpcError(error, 'Seller application review', '031 admin approval migration')); else await load(); setProcessingId(null) }
  return <AdminShell><AdminPageHeader title="সেলার ভেরিফিকেশন রিভিউ" description="প্রতিটি identity, business এবং ownership document আলাদাভাবে review করুন। সব required check pass না হলে approval হবে না।" /><div className="mb-5 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm leading-6 text-brand-800"><FileCheck2 className="mr-2 inline-block align-text-bottom" size={17} />Approved seller-এর profile-এ mode ও sector অনুযায়ী trust badge তৈরি হবে। Sensitive documents public করা হয় না।</div>{loading ? <AdminTableCard><p className="p-10 text-center text-sm text-slate-500">আবেদন লোড হচ্ছে...</p></AdminTableCard> : registrations.length === 0 ? <AdminTableCard><p className="p-10 text-center text-sm text-slate-500">অনুমোদনের অপেক্ষায় কোনো আবেদন নেই।</p></AdminTableCard> : <div className="space-y-5">{registrations.map((reg) => { const approvedCount = reg.documents.filter((doc) => doc.status === 'APPROVED').length; return <AdminTableCard key={reg.id}><div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5"><div><h2 className="font-semibold text-slate-900">{reg.full_name}</h2><p className="mt-1 text-xs text-slate-500">{reg.listing_mode === 'DIGITAL' ? 'ডিজিটাল' : 'ফিজিক্যাল'} · {reg.business_type ?? 'PERSONAL'} · {reg.sector ?? 'OTHER'}</p><p className="mt-1 text-xs text-slate-400">জমা: {formatDateTime(reg.submitted_at)}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">{approvedCount}/{reg.documents.length} document approved</span></div><div className="grid gap-3 p-5 sm:grid-cols-2"><Info label="ফোন" value={reg.phone} /><Info label="NID/Business no." value={reg.nid_or_business_number} /><Info label="ব্যবসার নাম" value={reg.business_name || 'প্রযোজ্য নয়'} /><Info label="ঠিকানা" value={reg.address} /></div><div className="space-y-3 px-5 pb-5">{reg.documents.map((doc) => <div key={doc.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-slate-800">{doc.document_type}</p><span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${doc.status === 'APPROVED' ? 'bg-brand-50 text-brand-700' : doc.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{doc.status === 'APPROVED' ? <CheckCircle2 size={12} /> : doc.status === 'REJECTED' ? <XCircle size={12} /> : <FileCheck2 size={12} />}{doc.status}</span></div>{docUrls[doc.id] && <a href={docUrls[doc.id]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><LinkIcon size={13} />Document দেখুন</a>}</div><textarea value={noteById[doc.id] ?? ''} onChange={(e) => setNoteById((current) => ({ ...current, [doc.id]: e.target.value }))} rows={1} placeholder="এই document-এর review note" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-500" /><div className="mt-2 flex gap-2"><button type="button" onClick={() => reviewDocument(doc.id, 'APPROVED')} disabled={processingId === doc.id} className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><Check size={13} />Approve</button><button type="button" onClick={() => reviewDocument(doc.id, 'REJECTED')} disabled={processingId === doc.id} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"><X size={13} />Reject</button></div></div>)}</div><div className="flex flex-wrap gap-2 border-t border-slate-200 p-5"><textarea value={noteById[reg.id] ?? ''} onChange={(e) => setNoteById((current) => ({ ...current, [reg.id]: e.target.value }))} rows={2} placeholder="Final review note" className="min-w-[240px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" /><button type="button" onClick={() => finalize(reg.id, 'APPROVED')} disabled={processingId === reg.id} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Final approve</button><button type="button" onClick={() => finalize(reg.id, 'REJECTED')} disabled={processingId === reg.id} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">Reject application</button></div></AdminTableCard> })}</div>}<AdminTableCard><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-900">Seller approval history</h2><p className="mt-1 text-xs text-slate-500">কে কোন seller বা document approve/reject করেছে, তার Gmail ও UID এখানে থাকবে।</p></div>{historyLoading ? <p className="p-6 text-sm text-slate-500">History লোড হচ্ছে...</p> : reviewHistory.length === 0 ? <p className="p-6 text-sm text-slate-500">এখনো কোনো seller approval history নেই।</p> : <div className="divide-y divide-slate-100">{reviewHistory.map((entry) => <div key={`${entry.registration_id}-${entry.created_at}-${entry.admin_uid}`} className="grid gap-2 px-5 py-4 md:grid-cols-[1fr_1fr_1fr_1.2fr]"><div><p className="font-semibold text-slate-800">{entry.applicant_name}</p><p className="text-xs text-slate-400">{entry.applicant_user_id}</p></div><div><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${entry.action.includes('APPROVED') ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>{entry.action}</span><p className="mt-1 text-xs text-slate-500">{entry.document_type || 'Final application'}</p></div><div><p className="text-xs font-semibold text-slate-700">{entry.admin_email || 'ইমেইল নেই'}</p><p className="break-all text-[10px] text-slate-400">UID: {entry.admin_uid}</p></div><div><p className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</p>{entry.note && <p className="mt-1 text-xs text-slate-600">{entry.note}</p>}</div></div>)}</div>}</AdminTableCard><Link to="/admin" className="mt-5 inline-flex text-sm font-semibold text-brand-700">← Admin dashboard</Link><BrandedDialog open={Boolean(notice)} title="Verification update" onClose={() => setNotice(null)} actions={<DialogButton onClick={() => setNotice(null)}>ঠিক আছে</DialogButton>}><p>{notice}</p></BrandedDialog></AdminShell>
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div> }
