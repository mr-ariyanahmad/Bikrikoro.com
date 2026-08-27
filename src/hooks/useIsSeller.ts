import { useLayoutEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabaseConfigured } from '@/lib/supabase'
import { auth } from '@/lib/firebase'
import { readCachedValue, userCacheKey, writeCachedValue } from '@/lib/clientCache'

const SELLER_STATUS_CACHE_MS = 60 * 1000
type SellerStatusCache = { isSeller: boolean }

export function useIsSeller() {
  const { user } = useAuth()
  const [isSeller, setIsSeller] = useState(false)
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useLayoutEffect(() => {
    let active = true
    if (!user?.uid) {
      setIsSeller(false)
      setCheckedUserId(null)
      setLoading(false)
      return () => { active = false }
    }

    if (!supabaseConfigured) {
      setIsSeller(false)
      setCheckedUserId(user.uid)
      setLoading(false)
      return () => { active = false }
    }

    const cacheKey = userCacheKey(user.uid, 'seller-status')
    const cachedStatus = readCachedValue<SellerStatusCache>(cacheKey, SELLER_STATUS_CACHE_MS)
    if (cachedStatus) {
      setIsSeller(cachedStatus.value.isSeller)
      setCheckedUserId(user.uid)
      setLoading(false)
    } else {
      setLoading(true)
      setIsSeller(false)
      setCheckedUserId(null)
    }

    const loadSellerStatus = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('Firebase session পাওয়া যায়নি।')
        const response = await fetch('/api/seller-verification-status', { headers: { Authorization: `Bearer ${idToken}` } })
        const payload = await response.json().catch(() => ({})) as { error?: string; isSeller?: boolean }
        if (!response.ok) throw new Error(payload.error || `Seller access check failed (HTTP ${response.status})`)
        if (!active) return
        const isSeller = payload.isSeller === true
        setIsSeller(isSeller)
        setCheckedUserId(user.uid)
        writeCachedValue(cacheKey, { isSeller })
      } catch (error) {
        console.error('Seller access check failed:', error)
        if (active) {
          if (!cachedStatus) setIsSeller(false)
          setCheckedUserId(user.uid)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadSellerStatus()
    return () => { active = false }
  }, [user?.uid])

  return { isSeller: checkedUserId === user?.uid && isSeller, loading: loading || Boolean(user?.uid && checkedUserId !== user.uid) }
}
