import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabaseConfigured } from '@/lib/supabase'
import { auth } from '@/lib/firebase'

export function useIsSeller() {
  const { user } = useAuth()
  const [isSeller, setIsSeller] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!user?.uid) {
      setIsSeller(false)
      setLoading(false)
      return () => { active = false }
    }

    if (!supabaseConfigured) {
      setIsSeller(false)
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    const loadSellerStatus = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('Firebase session পাওয়া যায়নি।')
        const response = await fetch('/api/seller-verification-status', { headers: { Authorization: `Bearer ${idToken}` } })
        const payload = await response.json().catch(() => ({})) as { error?: string; isSeller?: boolean }
        if (!response.ok) throw new Error(payload.error || `Seller access check failed (HTTP ${response.status})`)
        if (!active) return
        setIsSeller(payload.isSeller === true)
      } catch (error) {
        console.error('Seller access check failed:', error)
        if (active) setIsSeller(false)
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadSellerStatus()
    return () => { active = false }
  }, [user?.uid])

  return { isSeller, loading }
}
