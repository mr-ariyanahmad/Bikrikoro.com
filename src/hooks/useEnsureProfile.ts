import { useEffect } from 'react'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'

/**
 * profiles.id is the Firebase UID. Profile creation is performed by the
 * Firebase-verified server endpoint because the public Supabase client must
 * not be allowed to insert arbitrary profile rows.
 */
export function useEnsureProfile() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function ensure() {
      try {
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken || cancelled) return
        const response = await fetch('/api/profile-bootstrap', {
          method: 'POST',
          headers: { Authorization: `Bearer ${idToken}` },
        })
        if (!response.ok) {
          const result = await response.json().catch(() => ({})) as { error?: string }
          throw new Error(result.error || `Profile bootstrap failed (HTTP ${response.status})`)
        }
      } catch (error) {
        console.error('Profile bootstrap failed:', error instanceof Error ? error.message : error)
      }
    }

    void ensure()
    return () => {
      cancelled = true
    }
  }, [user])
}
