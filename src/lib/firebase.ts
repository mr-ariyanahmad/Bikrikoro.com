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

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Missing Firebase env vars. Copy .env.example to .env and fill in the VITE_FIREBASE_* values from Firebase Console.'
  )
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// Keep Firebase's built-in account emails aligned with the Bengali-first UI.
auth.languageCode = 'bn'
