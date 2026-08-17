import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  sendEmailVerification,
  getRedirectResult,
  signInWithRedirect,
  updateProfile,
  signOut as firebaseSignOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  signInWithPopup,
  type ConfirmationResult,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth, firebaseConfigured } from '@/lib/firebase'
import { registerPushToken } from '@/lib/pushNotifications'

interface AuthContextValue {
  user: FirebaseUser | null
  loading: boolean
  sendOtp: (phoneE164: string) => Promise<ConfirmationResult>
  verifyOtp: (confirmation: ConfirmationResult, code: string) => Promise<void>
  loginWithEmail: (email: string, password: string) => Promise<void>
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>
  sendPasswordReset: (email: string) => Promise<void>
  changePassword: (password: string) => Promise<void>
  sendVerificationEmail: () => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Invisible reCAPTCHA container, created once and reused across OTP
// requests — matches the invisible-verifier behavior Firebase Phone Auth
// uses on Android too, so there's no visible captcha widget for the user.
let recaptchaVerifier: RecaptchaVerifier | null = null
function ensureFirebaseConfigured() {
  if (!firebaseConfigured) {
    const error = new Error('Firebase configuration is missing') as Error & { code?: string }
    error.code = 'firebase/not-configured'
    throw error
  }
}

function getRecaptchaVerifier(): RecaptchaVerifier {
  ensureFirebaseConfigured()
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })
  }
  return recaptchaVerifier
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!user?.uid || !firebaseConfigured) return
    void registerPushToken(user.uid)
  }, [user?.uid])

  useEffect(() => {
    if (!firebaseConfigured) return
    // Redirect is the reliable path on mobile browsers and on browsers that block
    // third-party popup storage. The result is resolved once when the app returns.
    getRedirectResult(auth).catch((error) => {
      console.warn('Google redirect sign-in failed:', error)
    })
  }, [])

  const sendOtp = (phoneE164: string) => {
    ensureFirebaseConfigured()
    return signInWithPhoneNumber(auth, phoneE164, getRecaptchaVerifier())
  }

  const verifyOtp = async (confirmation: ConfirmationResult, code: string) => {
    ensureFirebaseConfigured()
    await confirmation.confirm(code)
  }

  const loginWithEmail = async (email: string, password: string) => {
    ensureFirebaseConfigured()
    await signInWithEmailAndPassword(auth, email, password)
  }

  const registerWithEmail = async (name: string, email: string, password: string) => {
    ensureFirebaseConfigured()
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(credential.user, { displayName: name })
  }

  const sendPasswordReset = (email: string) => {
    ensureFirebaseConfigured()
    return sendPasswordResetEmail(auth, email.trim())
  }

  const changePassword = async (password: string) => {
    ensureFirebaseConfigured()
    if (!auth.currentUser) throw new Error('auth/no-current-user')
    await updatePassword(auth.currentUser, password)
  }

  const sendVerificationEmail = async () => {
    ensureFirebaseConfigured()
    if (!auth.currentUser) throw new Error('auth/no-current-user')
    await sendEmailVerification(auth.currentUser)
  }

  // Requires the Google provider to be turned on in Firebase Console →
  // Authentication → Sign-in method → Google (same project as the
  // phone/email sign-in already used here). Also add this site's domain
  // (e.g. bikrikoro.com and localhost) under Authorized domains, or the
  // popup will fail with auth/unauthorized-domain.
  const googleProvider = new GoogleAuthProvider()
  googleProvider.setCustomParameters({ prompt: 'select_account' })
  const loginWithGoogle = async () => {
    ensureFirebaseConfigured()
    const isMobileBrowser = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobileBrowser) {
      await signInWithRedirect(auth, googleProvider)
      return
    }
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, googleProvider)
        return
      }
      throw error
    }
  }

  const logout = () => firebaseSignOut(auth)

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sendOtp,
        verifyOtp,
        loginWithEmail,
        registerWithEmail,
        sendPasswordReset,
        changePassword,
        sendVerificationEmail,
        loginWithGoogle,
        logout,
      }}
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
