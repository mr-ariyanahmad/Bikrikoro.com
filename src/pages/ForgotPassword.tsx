import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'

function authErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (code === 'auth/invalid-email') return 'সঠিক ইমেইল ঠিকানা লিখুন।'
  if (code === 'auth/user-not-found') return 'এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।'
  if (code === 'auth/too-many-requests') return 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
  return 'রিসেট ইমেইল পাঠানো যায়নি। আবার চেষ্টা করুন।'
}

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('আপনার ইমেইল ঠিকানা লিখুন।')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await sendPasswordReset(email)
      setSent(true)
    } catch (err) {
      console.error('password reset failed:', err)
      setError(authErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-outline bg-surface p-6 shadow-sm sm:p-8">
          <div className="text-center">
            <img src="/icon-192.png" alt="BikriKoro" className="mx-auto mb-4 h-14 w-14 rounded-2xl" />
            <h1 className="text-xl font-semibold text-ink-900">পাসওয়ার্ড ভুলে গেছেন?</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              আপনার অ্যাকাউন্টের ইমেইল দিন। আমরা পাসওয়ার্ড নতুন করে সেট করার একটি লিংক পাঠাব।
            </p>
          </div>

          {sent ? (
            <div className="mt-6 rounded-xl bg-brand-50 p-4 text-center text-sm leading-relaxed text-brand-700">
              রিসেট লিংক পাঠানো হয়েছে। আপনার ইনবক্স ও spam folder দেখুন, তারপর ইমেইলের লিংকে চাপুন।
              <Link to="/login" className="mt-3 block font-semibold underline">
                লগইনে ফিরে যান
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <label className="block text-sm font-medium text-ink-900" htmlFor="reset-email">
                ইমেইল ঠিকানা
              </label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="আপনার ইমেইল লিখুন"
                className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              {error && <p className="text-sm text-error">{error}</p>}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'পাঠানো হচ্ছে...' : 'রিসেট লিংক পাঠান'}
              </button>
              <Link to="/login" className="block text-center text-sm font-medium text-ink-600 hover:text-brand-600">
                লগইনে ফিরে যান
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
