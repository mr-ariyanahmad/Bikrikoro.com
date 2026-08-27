import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  sendEmailVerification,
  getRedirectResult,
  browserLocalPersistence,
  setPersistence,
  signInWithRedirect,
  updateProfile,
  signOut as firebaseSignOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  type ConfirmationResult,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth, firebaseConfigured } from '@/lib/firebase'
import { clearUserCachedData } from '@/lib/clientCache'

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
  loginWithFacebook: () => Promise<void>
  authError: string | null
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const GOOGLE_REDIRECT_PENDING_KEY = 'bikrikoro:google-redirect-pending'
const FACEBOOK_REDIRECT_PENDING_KEY = 'bikrikoro:facebook-redirect-pending'

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

function resetRecaptchaVerifier() {
  recaptchaVerifier?.clear()
  recaptchaVerifier = null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false)
      return
    }
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) setAuthError(null)
      setLoading(false)
    })
    void setPersistence(auth, browserLocalPersistence)
      .then(() => getRedirectResult(auth))
      .then((result) => {
        if (result?.user) {
          window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY)
          window.sessionStorage.removeItem(FACEBOOK_REDIRECT_PENDING_KEY)
        } else if ((window.sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) || window.sessionStorage.getItem(FACEBOOK_REDIRECT_PENDING_KEY)) && !auth.currentUser) {
          window.sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY)
          window.sessionStorage.removeItem(FACEBOOK_REDIRECT_PENDING_KEY)
          setAuthError('auth/redirect-session-not-found')
        }
      })
      .catch((error) => {
        const code = (error as { code?: string }).code ?? 'auth/redirect-failed'
        console.warn('Google redirect sign-in failed:', code, error)
        setAuthError(code)
      })
    return unsubscribe
  }, [])

  const sendOtp = async (phoneE164: string) => {
    ensureFirebaseConfigured()
    try {
      return await signInWithPhoneNumber(auth, phoneE164, getRecaptchaVerifier())
    } catch (error) {
      resetRecaptchaVerifier()
      throw error
    }
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
    setAuthError(null)
    await setPersistence(auth, browserLocalPersistence)
    try {
      // A user-initiated popup avoids the mobile redirect callback/storage path
      // that can return to /login without restoring the Firebase session.
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        window.sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, '1')
        await signInWithRedirect(auth, googleProvider)
        return
      }
      throw error
    }
  }

  const facebookProvider = new FacebookAuthProvider()
  facebookProvider.addScope('email')
  const loginWithFacebook = async () => {
    ensureFirebaseConfigured()
    setAuthError(null)
    await setPersistence(auth, browserLocalPersistence)

    // Mobile browsers—especially Brave—can close or isolate the OAuth popup
    // because of popup, storage, or third-party-cookie protections. Redirect
    // first on mobile so the Firebase session returns through the same browser
    // tab and is restored by getRedirectResult above.
    const isMobileBrowser = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    if (isMobileBrowser) {
      window.sessionStorage.setItem(FACEBOOK_REDIRECT_PENDING_KEY, '1')
      await signInWithRedirect(auth, facebookProvider)
      return
    }

    try {
      await signInWithPopup(auth, facebookProvider)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment' || code === 'auth/popup-closed-by-user') {
        window.sessionStorage.setItem(FACEBOOK_REDIRECT_PENDING_KEY, '1')
        await signInWithRedirect(auth, facebookProvider)
        return
      }
      throw error
    }
  }

  const logout = async () => {
    const userId = auth.currentUser?.uid
    if (userId) clearUserCachedData(userId)
    await firebaseSignOut(auth)
  }

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
        loginWithFacebook,
        authError,
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
