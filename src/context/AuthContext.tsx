import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
  type ConfirmationResult,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

interface AuthContextValue {
  user: FirebaseUser | null
  loading: boolean
  sendOtp: (phoneE164: string) => Promise<ConfirmationResult>
  verifyOtp: (confirmation: ConfirmationResult, code: string) => Promise<void>
  loginWithEmail: (email: string, password: string) => Promise<void>
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Invisible reCAPTCHA container, created once and reused across OTP
// requests — matches the invisible-verifier behavior Firebase Phone Auth
// uses on Android too, so there's no visible captcha widget for the user.
let recaptchaVerifier: RecaptchaVerifier | null = null
function getRecaptchaVerifier(): RecaptchaVerifier {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
  }
  return recaptchaVerifier
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
  }, [])

  const sendOtp = (phoneE164: string) =>
    signInWithPhoneNumber(auth, phoneE164, getRecaptchaVerifier())

  const verifyOtp = async (confirmation: ConfirmationResult, code: string) => {
    await confirmation.confirm(code)
  }

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const registerWithEmail = async (name: string, email: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(credential.user, { displayName: name })
  }

  // Requires the Google provider to be turned on in Firebase Console →
  // Authentication → Sign-in method → Google (same project as the
  // phone/email sign-in already used here). Also add this site's domain
  // (e.g. bikrikoro.com and localhost) under Authorized domains, or the
  // popup will fail with auth/unauthorized-domain.
  const googleProvider = new GoogleAuthProvider()
  const loginWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider)
  }

  const logout = () => firebaseSignOut(auth)

  return (
    <AuthContext.Provider
      value={{ user, loading, sendOtp, verifyOtp, loginWithEmail, registerWithEmail, loginWithGoogle, logout }}
    >
      {children}
      {/* Target for the invisible reCAPTCHA used by sendOtp — kept off-screen, never shown to the user. */}
      <div id="recaptcha-container" />
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
