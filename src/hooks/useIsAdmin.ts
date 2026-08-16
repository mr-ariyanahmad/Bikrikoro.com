import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export function useIsAdmin(): { isAdmin: boolean; loading: boolean } {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.email) {
      setIsAdmin(false)
      setLoading(false)
      return
    }

    supabase
      .from('admin_emails')
      .select('email')
      .eq('email', user.email)
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(Boolean(data))
        setLoading(false)
      })
  }, [user?.email])

  return { isAdmin, loading }
}
