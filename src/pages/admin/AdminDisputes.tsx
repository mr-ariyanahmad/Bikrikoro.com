import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/lib/format'
import { resolveDispute } from '@/lib/admin'
import { supabase } from '@/lib/supabase'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import type { OrderDispute } from '@/types/order'

export default function AdminDisputes() {
  const { user } = useAuth()
  const [disputes, setDisputes] = useState<OrderDispute[]>([])
  const [loading, setLoading] = useState(true)
  const [noteByDispute, setNoteByDispute] = useState<Record<string, string>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolveTarget, setResolveTarget] = useState<{ id: string; status: 'RESOLVED_REFUNDED' | 'RESOLVED_DENIED' } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase.from('order_disputes').select('*').in('status', ['REPORTED', 'UNDER_REVIEW']).order('created_at', { ascending: true })
    setDisputes((data ?? []) as OrderDispute[])
    if (loadError) setError('Dispute লোড করা যায়নি।')
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const handleResolve = async (disputeId: string, status: 'RESOLVED_REFUNDED' | 'RESOLVED_DENIED') => {
    setProcessingId(disputeId)
    try {
      await resolveDispute({ adminId: user!.uid, disputeId, status, resolutionNote: noteByDispute[disputeId]?.trim() || '' })
      await load()
    } catch { setError('সমাধান করা যায়নি — আবার চেষ্টা করুন।') } finally { setProcessingId(null) }
  }

  return <AdminShell><AdminPageHeader title="ডিসপিউট রিভিউ" description="Buyer report, evidence এবং refund decision এক জায়গা থেকে পরিচালনা করুন।" /><AdminTableCard>{loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : disputes.length === 0 ? <div className="p-10 text-center"><CheckCircle2 className="mx-auto text-brand-500" size={34} /><p className="mt-3 font-semibold text-slate-800">কোনো pending dispute নেই</p><p className="mt-1 text-sm text-slate-500">সব report review করা হয়েছে।</p></div> : <div className="divide-y divide-slate-100">{disputes.map((dispute) => <div key={dispute.id} className="space-y-4 px-5 py-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><AlertTriangle size={17} className="text-amber-500" /><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{dispute.reason}</span></div><p className="mt-2 text-sm leading-relaxed text-slate-700">{dispute.description}</p></div><span className="shrink-0 text-xs text-slate-400">{formatDateTime(dispute.created_at)}</span></div>{dispute.evidence_urls.length > 0 && <div className="flex gap-2 overflow-x-auto">{dispute.evidence_urls.map((url) => <img key={url} src={url} alt="প্রমাণ" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />)}</div>}<Link to={`/disputes/${dispute.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">পুরো thread দেখুন <ExternalLink size={13} /></Link><textarea value={noteByDispute[dispute.id] ?? ''} onChange={(e) => setNoteByDispute((prev) => ({ ...prev, [dispute.id]: e.target.value }))} rows={2} placeholder="Buyer-কে যা জানাতে চান (ঐচ্ছিক)" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" /><div className="flex flex-wrap gap-2"><button onClick={() => setResolveTarget({ id: dispute.id, status: 'RESOLVED_REFUNDED' })} disabled={processingId === dispute.id} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 size={16} />Refund approve</button><button onClick={() => setResolveTarget({ id: dispute.id, status: 'RESOLVED_DENIED' })} disabled={processingId === dispute.id} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"><XCircle size={16} />Deny report</button></div></div>)}</div>}</AdminTableCard><BrandedDialog open={Boolean(resolveTarget)} title={resolveTarget?.status === 'RESOLVED_REFUNDED' ? 'Refund approve করবেন?' : 'Dispute deny করবেন?'} tone={resolveTarget?.status === 'RESOLVED_REFUNDED' ? 'brand' : 'danger'} onClose={() => setResolveTarget(null)} actions={<><DialogButton onClick={() => setResolveTarget(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={() => { if (resolveTarget) handleResolve(resolveTarget.id, resolveTarget.status); setResolveTarget(null) }} tone={resolveTarget?.status === 'RESOLVED_REFUNDED' ? 'brand' : 'danger'}>নিশ্চিত করুন</DialogButton></>}><p>{resolveTarget?.status === 'RESOLVED_REFUNDED' ? 'Buyer-এর wallet-এ refund প্রক্রিয়া শুরু হবে।' : 'এই report deny করা হবে এবং dispute resolution log-এ যুক্ত হবে।'}</p></BrandedDialog>{error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}</AdminShell>
}
