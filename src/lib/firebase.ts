import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

/**
 * MUST point at the SAME Firebase project as the Android app
 * (google-services.json's project_id) — every table this site reads
 * (profiles, orders, wallet_*) keys users by Firebase uid as text, not
 * Supabase auth. A different Firebase project here would mean every
 * login gets a uid with no matching data anywhere.
 */
const configuredAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim()
const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim()
const defaultFirebaseAuthDomain = firebaseProjectId ? `${firebaseProjectId}.firebaseapp.com` : ''
const useBrandedAuthDomain = import.meta.env.VITE_USE_BRANDED_AUTH_DOMAIN === 'true'
const firebaseAuthDomain = useBrandedAuthDomain && configuredAuthDomain
  ? configuredAuthDomain
  : defaultFirebaseAuthDomain

/**
 * Phone reCAPTCHA and redirect-based social auth depend on Firebase's auth
 * handler being reachable from the configured authDomain. Keep production on
 * the Firebase default domain unless the custom Firebase Hosting domain has
 * been fully configured, verified, and enabled deliberately. This prevents a
 * partially configured auth.bikrikoro.com migration from breaking all login
 * methods while preserving the option to enable the branded domain later.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: firebaseAuthDomain,
  projectId: firebaseProjectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId)

let configuredApp: FirebaseApp | null = null
if (firebaseConfigured) configuredApp = initializeApp(firebaseConfig)

function createUnavailableAuth(): Auth {
  return new Proxy({ currentUser: null, languageCode: 'bn' } as unknown as Auth, {
    get(target, property, receiver) {
      if (property === 'currentUser' || property === 'languageCode') return Reflect.get(target, property, receiver)
      throw new Error('Firebase configuration is missing')
    },
  })
}

/**
 * When Firebase variables are absent, this is deliberately a no-op object—not
 * a fake Firebase project. AuthContext checks firebaseConfigured before
 * subscribing, while guarded actions receive a clear not-configured error.
 */
export const app = configuredApp
export const auth: Auth = configuredApp ? getAuth(configuredApp) : createUnavailableAuth()
if (firebaseConfigured) auth.languageCode = 'bn'

if (!firebaseConfigured) {
  console.warn('Firebase is not configured. Login and account features are disabled until VITE_FIREBASE_* variables are provided.')
}
