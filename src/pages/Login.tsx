import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { ConfirmationResult } from 'firebase/auth'
import { useAuth } from '@/context/AuthContext'

function toE164(bdLocalNumber: string): string {
  const digits = bdLocalNumber.replace(/\D/g, '')
  if (digits.startsWith('880')) return `+${digits}`
  if (digits.startsWith('0')) return `+88${digits}`
  return `+880${digits}`
}

export default function Login() {
  const { user, sendOtp, verifyOtp, loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth()
  const [mode, setMode] = useState<'phone' | 'email'>('phone')
  const [googleLoading, setGoogleLoading] = useState(false)

  // Phone flow
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null)

  // Email flow
  const [isRegistering, setIsRegistering] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to="/" replace />

  const handleSendOtp = async () => {
    setError(null)
    setLoading(true)
    try {
      const result = await sendOtp(toE164(phone))
      setConfirmation(result)
    } catch (err) {
      console.error('sendOtp failed:', err)
      setError('OTP পাঠানো যায়নি — নম্বরটি আবার যাচাই করুন।')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!confirmation) return
    setError(null)
    setLoading(true)
    try {
      await verifyOtp(confirmation, otp)
    } catch (err) {
      console.error('verifyOtp failed:', err)
      setError('কোডটি সঠিক নয় — আবার চেষ্টা করুন।')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = async () => {
    setError(null)
    setLoading(true)
    try {
      if (isRegistering) {
        await registerWithEmail(name, email, password)
      } else {
        await loginWithEmail(email, password)
      }
    } catch (err) {
      console.error('email auth failed:', err)
      setError(isRegistering ? 'অ্যাকাউন্ট তৈরি করা যায়নি।' : 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setGoogleLoading(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      console.error('Google login failed:', err)
      setError('গুগল দিয়ে লগইন করা যায়নি — আবার চেষ্টা করুন।')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/icon-192.png" alt="BikriKoro" className="mx-auto mb-3 h-14 w-14 rounded-2xl" />
          <h1 className="text-xl font-semibold text-ink-900">BikriKoro ওয়ালেট</h1>
          <p className="mt-1 text-sm text-ink-600">লগইন করে আপনার ব্যালেন্স দেখুন</p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-outline bg-surface py-3 text-sm font-semibold text-ink-900 transition hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.56 2.7-3.87 2.7-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.16.29-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
          </svg>
          {googleLoading ? 'অপেক্ষা করুন...' : 'Google দিয়ে চালিয়ে যান'}
        </button>

        <div className="mb-4 flex items-center gap-3 text-xs text-ink-300">
          <div className="h-px flex-1 bg-outline" />
          অথবা
          <div className="h-px flex-1 bg-outline" />
        </div>

        <div className="mb-5 flex rounded-lg border border-outline p-1">
          <button
            onClick={() => setMode('phone')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === 'phone' ? 'bg-brand-500 text-white' : 'text-ink-600'
            }`}
          >
            ফোন নম্বর
          </button>
          <button
            onClick={() => setMode('email')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              mode === 'email' ? 'bg-brand-500 text-white' : 'text-ink-600'
            }`}
          >
            ইমেইল
          </button>
        </div>

        {mode === 'phone' && (
          <div className="space-y-3">
            {!confirmation ? (
              <>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="০১XXXXXXXXX"
                  className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                <button
                  onClick={handleSendOtp}
                  disabled={loading || phone.trim().length < 11}
                  className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'পাঠানো হচ্ছে...' : 'OTP পাঠান'}
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="৬ সংখ্যার কোড"
                  className="tabular-amount w-full rounded-lg border border-outline px-3 py-2.5 text-center text-lg tracking-widest outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.trim().length < 6}
                  className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'যাচাই করা হচ্ছে...' : 'যাচাই করুন'}
                </button>
              </>
            )}
          </div>
        )}

        {mode === 'email' && (
          <div className="space-y-3">
            {isRegistering && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="নাম"
                className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ইমেইল"
              className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="পাসওয়ার্ড"
              className="w-full rounded-lg border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <button
              onClick={handleEmailSubmit}
              disabled={loading}
              className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'অপেক্ষা করুন...' : isRegistering ? 'অ্যাকাউন্ট তৈরি করুন' : 'লগইন করুন'}
            </button>
            <button
              onClick={() => setIsRegistering((v) => !v)}
              className="w-full text-center text-sm text-ink-600 hover:text-brand-600"
            >
              {isRegistering ? 'আগে থেকে অ্যাকাউন্ট আছে? লগইন করুন' : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-center text-sm text-error">{error}</p>}
      </div>
    </div>
  )
}
