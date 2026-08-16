import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

/**
 * profiles.id is the Firebase UID (see 001_init.sql) — every table that
 * references a user (products.seller_id, orders.buyer_id, wallet_balances,
 * ...) has a foreign key into profiles. Without this, a brand-new user's
 * very first insert (e.g. posting a listing) would fail on the FK
 * constraint since no profiles row exists for their uid yet.
 */
export function useEnsureProfile() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function ensure() {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user!.uid)
        .maybeSingle()

      if (cancelled || existing) return

      const { error } = await supabase.from('profiles').insert({
        id: user!.uid,
        name: user!.displayName ?? '',
        phone: user!.phoneNumber,
        email: user!.email,
        photo_url: user!.photoURL,
      })
      if (error) console.error('Profile creation failed:', error.message)
    }

    ensure()
    return () => {
      cancelled = true
    }
  }, [user])
}
