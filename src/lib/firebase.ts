import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

/**
 * MUST point at the SAME Firebase project as the Android app
 * (google-services.json's project_id) — every table this site reads
 * (profiles, orders, wallet_*) keys users by Firebase uid as text, not
 * Supabase auth. A different Firebase project here would mean every
 * login gets a uid with no matching data anywhere.
 */
const configuredAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID
const currentHost = typeof window !== 'undefined' ? window.location.hostname : ''
const productionHost = currentHost === 'www.bikrikoro.com' || currentHost === 'bikrikoro.com'
const defaultFirebaseAuthDomain = firebaseProjectId ? `${firebaseProjectId}.firebaseapp.com` : configuredAuthDomain

/**
 * Keep production on Firebase's default auth domain. Its OAuth redirect URI is
 * already registered by Firebase, so mobile users do not need to edit Google
 * Cloud settings. Preview/local environments continue to use the configured
 * domain so existing development setups remain unchanged.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: productionHost ? defaultFirebaseAuthDomain : configuredAuthDomain,
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
