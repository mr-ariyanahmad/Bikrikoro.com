import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase, supabaseConfigured } from '@/lib/supabase'

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
        const [profileResult, registrationResult] = await Promise.all([
          supabase.from('profiles').select('is_verified').eq('id', user.uid).maybeSingle(),
          supabase.from('seller_registrations').select('id').eq('user_id', user.uid).eq('status', 'APPROVED').limit(1),
        ])
        if (!active) return
        setIsSeller(Boolean(profileResult.data?.is_verified || registrationResult.data?.length))
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
