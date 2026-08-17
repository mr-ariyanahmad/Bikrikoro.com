import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

/**
 * MUST point at the SAME Firebase project as the Android app
 * (google-services.json's project_id) — every table this site reads
 * (profiles, orders, wallet_*) keys users by Firebase uid as text, not
 * Supabase auth. A different Firebase project here would mean every
 * login gets a uid with no matching data anywhere.
 *
 * Get these values from Firebase Console → Project settings → General →
 * "Your apps" → Web app (add one if none exists yet — it's free, just a
 * config object, no extra billing).
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId)
if (!firebaseConfigured) {
  console.warn('Firebase is not configured. Public pages remain available, but login and account features require VITE_FIREBASE_* variables.')
}

const localFallbackConfig = {
  apiKey: 'AIzaSyBikriKoroLocalPlaceholder000000000',
  authDomain: 'bikrikoro-local.invalid',
  projectId: 'bikrikoro-local',
  storageBucket: 'bikrikoro-local.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
}

export const app = initializeApp(firebaseConfigured ? firebaseConfig : localFallbackConfig)
export const auth = getAuth(app)
// Keep Firebase's built-in account emails aligned with the Bengali-first UI.
auth.languageCode = 'bn'
