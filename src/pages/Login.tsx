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
  const { user, sendOtp, verifyOtp, loginWithEmail, registerWithEmail } = useAuth()
  const [mode, setMode] = useState<'phone' | 'email'>('phone')

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
    } catch {
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
    } catch {
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
    } catch {
      setError(isRegistering ? 'অ্যাকাউন্ট তৈরি করা যায়নি।' : 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।')
    } finally {
      setLoading(false)
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
