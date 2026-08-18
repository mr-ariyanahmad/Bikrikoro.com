import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { sendDisputeMessage } from '@/lib/orders'
import { formatDateTime } from '@/lib/format'
import type { OrderDispute, DisputeMessage, DisputeStatus } from '@/types/order'

const STATUS_LABEL: Record<DisputeStatus, string> = {
  REPORTED: 'রিপোর্ট জমা হয়েছে',
  UNDER_REVIEW: 'পর্যালোচনাধীন',
  RESOLVED_REFUNDED: 'সমাধান — টাকা ফেরত',
  RESOLVED_DENIED: 'সমাধান — রিফান্ড প্রযোজ্য নয়',
}

export default function DisputeThread() {
  const { disputeId } = useParams<{ disputeId: string }>()
  const { user } = useAuth()
  const uid = user!.uid

  const [dispute, setDispute] = useState<OrderDispute | null>(null)
  const [messages, setMessages] = useState<DisputeMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadDispute = useCallback(async () => {
    if (!disputeId) return
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) throw new Error('আপনার Firebase session পাওয়া যায়নি।')
      const response = await fetch('/api/order-read', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` }, body: JSON.stringify({ action: 'dispute', disputeId }) })
      const payload = await response.json().catch(() => ({})) as { error?: string; dispute?: OrderDispute; messages?: DisputeMessage[] }
      if (!response.ok || !payload.dispute) throw new Error(payload.error || 'রিপোর্টটি পাওয়া যায়নি।')
      setDispute(payload.dispute)
      setMessages(payload.messages ?? [])
      setError(null)
    } catch (loadError) {
      console.error('Dispute load failed:', loadError)
      setError(loadError instanceof Error ? loadError.message : 'রিপোর্ট লোড করা যায়নি।')
    }
  }, [disputeId])

  useEffect(() => {
    if (!disputeId) return

    async function init() {
      await loadDispute()
      setLoading(false)
    }
    void init()

    const disputeChannel = supabase
      .channel(`dispute-${disputeId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'order_disputes', filter: `id=eq.${disputeId}` },
        () => { void loadDispute() }
      )
      .subscribe()

    const messagesChannel = supabase
      .channel(`dispute-messages-${disputeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dispute_messages', filter: `dispute_id=eq.${disputeId}` },
        () => { void loadDispute() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(disputeChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [disputeId, loadDispute])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || !dispute || sending) return
    setSending(true)
    try {
      await sendDisputeMessage(dispute.id, uid, input.trim())
      setInput('')
    } catch (sendError) {
      console.error('Dispute message failed:', sendError)
      setError(sendError instanceof Error ? sendError.message : 'মেসেজ পাঠানো যায়নি।')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <Layout backFallback="/orders" backLabel="অর্ডারে ফিরুন">
        <div className="h-96 animate-pulse rounded-2xl bg-outline/40" />
      </Layout>
    )
  }

  if (error || !dispute) {
    return (
      <Layout backFallback="/orders" backLabel="অর্ডারে ফিরুন">
        <p className="py-16 text-center text-ink-600">{error ?? 'রিপোর্টটি পাওয়া যায়নি।'}</p>
      </Layout>
    )
  }

  const isResolved = dispute.status === 'RESOLVED_REFUNDED' || dispute.status === 'RESOLVED_DENIED'

  return (
      <Layout backFallback="/orders" backLabel="অর্ডারে ফিরুন">
        <h1 className="text-lg font-semibold text-ink-900">রিপোর্ট বিস্তারিত</h1>

      <div className="mt-4 rounded-xl border border-outline bg-surface p-4">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
            isResolved ? (dispute.status === 'RESOLVED_REFUNDED' ? 'bg-brand-100 text-brand-700' : 'bg-error/10 text-error') : 'bg-warning/10 text-warning'
          }`}
        >
          {STATUS_LABEL[dispute.status]}
        </span>
        <p className="mt-3 text-sm text-ink-900">{dispute.description}</p>
        {dispute.evidence_urls.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {dispute.evidence_urls.map((url) => (
              <img key={url} src={url} alt="প্রমাণ" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex h-[45vh] flex-col rounded-xl border border-outline bg-surface">
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-ink-300">এখনো কোনো মেসেজ নেই</p>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_role === 'BUYER'
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      isMine ? 'bg-brand-500 text-white' : 'bg-bg text-ink-900'
                    }`}
                  >
                    {!isMine && <p className="mb-0.5 text-[10px] font-semibold text-brand-600">BikriKoro সাপোর্ট</p>}
                    <p>{msg.message}</p>
                    <p className={`mt-1 text-[10px] ${isMine ? 'text-brand-50/70' : 'text-ink-300'}`}>
                      {formatDateTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {!isResolved && (
          <div className="flex items-center gap-2 border-t border-outline p-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="আরও তথ্য যোগ করুন..."
              className="flex-1 rounded-full border border-outline px-4 py-2 text-sm outline-none focus:border-brand-500"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              পাঠান
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
