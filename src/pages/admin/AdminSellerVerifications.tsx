import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { AdminShell } from '@/components/admin/AdminShell'
import { reviewSellerRegistration } from '@/lib/admin'
import { getVerificationDocUrl } from '@/lib/verification'
import { formatDateTime } from '@/lib/format'
import type { SellerRegistration } from '@/types/chat'

export default function AdminSellerVerifications() {
  const { user } = useAuth()
  const adminId = user!.uid

  const [registrations, setRegistrations] = useState<SellerRegistration[]>([])
  const [docUrls, setDocUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [noteById, setNoteById] = useState<Record<string, string>>({})
  const [processingId, setProcessingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('seller_registrations')
      .select('*')
      .eq('status', 'PENDING')
      .order('submitted_at', { ascending: true })

    const rows = data ?? []
    setRegistrations(rows)

    const urls: Record<string, string> = {}
    await Promise.all(
      rows.map(async (r) => {
        const url = await getVerificationDocUrl(r.document_path)
        if (url) urls[r.id] = url
      })
    )
    setDocUrls(urls)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setProcessingId(id)
    try {
      await reviewSellerRegistration({ adminId, registrationId: id, status, adminNote: noteById[id]?.trim() || '' })
      await load()
    } catch {
      alert('প্রক্রিয়া করা যায়নি — আবার চেষ্টা করুন।')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <AdminShell>
      <div className="flex items-center gap-2">
        <Link to="/admin" className="text-ink-600 hover:text-ink-900">
          ←
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">সেলার ভেরিফিকেশন</h1>
      </div>

      <div className="mt-5 space-y-4">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-outline/40" />
          ))
        ) : registrations.length === 0 ? (
          <div className="rounded-2xl border border-outline bg-surface p-8 text-center text-ink-600">
            অনুমোদনের অপেক্ষায় কোনো আবেদন নেই।
          </div>
        ) : (
          registrations.map((reg) => (
            <div key={reg.id} className="rounded-xl border border-outline bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-ink-600">
                  {reg.seller_type === 'INDIVIDUAL' ? 'ব্যক্তিগত' : 'ব্যবসায়িক'}
                </span>
                <span className="text-xs text-ink-300">{formatDateTime(reg.submitted_at)}</span>
              </div>

              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-600">নাম</dt>
                  <dd className="font-medium text-ink-900">{reg.full_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">ফোন</dt>
                  <dd className="font-medium text-ink-900">{reg.phone}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-600">{reg.seller_type === 'INDIVIDUAL' ? 'NID' : 'ট্রেড লাইসেন্স'}</dt>
                  <dd className="font-medium text-ink-900">{reg.nid_or_business_number}</dd>
                </div>
                {reg.business_name && (
                  <div className="flex justify-between">
                    <dt className="text-ink-600">ব্যবসার নাম</dt>
                    <dd className="font-medium text-ink-900">{reg.business_name}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-ink-600">ঠিকানা</dt>
                  <dd className="font-medium text-ink-900">{reg.address}</dd>
                </div>
              </dl>

              {docUrls[reg.id] && (
                <img
                  src={docUrls[reg.id]}
                  alt="ডকুমেন্ট"
                  className="mt-3 max-h-56 rounded-lg border border-outline"
                />
              )}

              <textarea
                value={noteById[reg.id] ?? ''}
                onChange={(e) => setNoteById((prev) => ({ ...prev, [reg.id]: e.target.value }))}
                rows={2}
                placeholder="বাতিল করলে কারণ লিখুন (ঐচ্ছিক)"
                className="mt-3 w-full rounded-lg border border-outline px-3 py-2 text-sm outline-none focus:border-brand-500"
              />

              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleReview(reg.id, 'APPROVED')}
                  disabled={processingId === reg.id}
                  className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  অনুমোদন করুন
                </button>
                <button
                  onClick={() => handleReview(reg.id, 'REJECTED')}
                  disabled={processingId === reg.id}
                  className="rounded-lg border border-error/40 px-3 py-1.5 text-sm font-medium text-error hover:bg-error/5 disabled:opacity-50"
                >
                  বাতিল করুন
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  )
}
