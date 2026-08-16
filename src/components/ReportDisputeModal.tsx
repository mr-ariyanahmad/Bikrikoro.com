import { useState } from 'react'
import { reportOrderDispute } from '@/lib/orders'
import { uploadDisputeEvidence } from '@/lib/storage'
import type { DisputeReason } from '@/types/order'

const REASONS: { value: DisputeReason; label: string }[] = [
  { value: 'NOT_RECEIVED', label: 'পণ্য হাতে পাইনি' },
  { value: 'DAMAGED', label: 'পণ্য ভাঙা/ক্ষতিগ্রস্ত' },
  { value: 'FAKE_OR_COUNTERFEIT', label: 'পণ্যটি নকল মনে হচ্ছে' },
  { value: 'NOT_AS_DESCRIBED', label: 'বিবরণের সাথে মিলছে না' },
  { value: 'WRONG_ITEM', label: 'ভুল পণ্য পাঠানো হয়েছে' },
  { value: 'OTHER', label: 'অন্য কোনো সমস্যা' },
]

export function ReportDisputeModal({
  orderId,
  buyerId,
  onClose,
  onSuccess,
}: {
  orderId: string
  buyerId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [reason, setReason] = useState<DisputeReason | null>(null)
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = reason !== null && description.trim().length >= 10

  const handleSubmit = async () => {
    if (!isValid || !reason) return
    setSubmitting(true)
    setError(null)

    try {
      const evidenceUrls = files.length ? await uploadDisputeEvidence(files, orderId) : []
      await reportOrderDispute({ orderId, buyerId, reason, description: description.trim(), evidenceUrls })
      onSuccess()
    } catch {
      setError('রিপোর্ট পাঠানো যায়নি — আবার চেষ্টা করুন।')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">সমস্যা রিপোর্ট করুন</h2>
          <button onClick={onClose} className="text-ink-300 hover:text-ink-600" aria-label="বন্ধ করুন">
            ✕
          </button>
        </div>

        <p className="mt-3 rounded-lg bg-bg p-3 text-xs text-ink-600">
          রিপোর্ট জমা দেওয়ার পর এসক্রোতে জমা থাকা টাকা বিক্রেতাকে ছাড়া হবে না, যতক্ষণ না BikriKoro পর্যালোচনা করে
          সমাধান করে।
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">কী সমস্যা হয়েছে?</label>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    reason === r.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-outline text-ink-600 hover:border-brand-500/40'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">বিস্তারিত লিখুন</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="কী হয়েছে বিস্তারিত লিখুন..."
              className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-900">প্রমাণস্বরূপ ছবি (ঐচ্ছিক)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))}
              className="w-full text-sm text-ink-600"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'পাঠানো হচ্ছে...' : 'রিপোর্ট জমা দিন'}
          </button>
        </div>
      </div>
    </div>
  )
}
