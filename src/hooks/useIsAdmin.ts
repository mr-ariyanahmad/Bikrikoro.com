import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

export type AdminAccess = { isAdmin: boolean; loading: boolean; roleKey: string | null; roleLabel: string | null; permissions: string[]; can: (permission: string) => boolean }

export function useIsAdmin(): AdminAccess {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [roleKey, setRoleKey] = useState<string | null>(null)
  const [roleLabel, setRoleLabel] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])

  useEffect(() => {
    let active = true
    if (!user?.uid) {
      setIsAdmin(false)
      setRoleKey(null)
      setRoleLabel(null)
      setPermissions([])
      setLoading(false)
      return () => { active = false }
    }

    setLoading(true)
    const loadAccess = async () => {
      try {
        const { data, error } = await supabase.rpc('admin_access', { p_user_id: user.uid }).maybeSingle()
        if (!active) return
        const access = data as { is_admin?: boolean; role_key?: string; role_label?: string; permissions?: unknown } | null
        if (!error && access?.is_admin) {
          const raw = access.permissions
          setIsAdmin(true)
          setRoleKey(access.role_key ?? null)
          setRoleLabel(access.role_label ?? null)
          setPermissions(Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [])
          return
        }

        if (user.email) {
          const legacy = await supabase.from('admin_emails').select('email').ilike('email', user.email).maybeSingle()
          if (!active) return
          setIsAdmin(Boolean(legacy.data))
          setRoleKey(legacy.data ? 'SUPER_ADMIN' : null)
          setRoleLabel(legacy.data ? 'পূর্ণ অ্যাডমিন' : null)
          setPermissions(legacy.data ? ['*'] : [])
        } else {
          setIsAdmin(false)
          setRoleKey(null)
          setRoleLabel(null)
          setPermissions([])
        }
      } catch (error) {
        console.error('Admin access check failed:', error)
        if (!active) return
        setIsAdmin(false)
        setRoleKey(null)
        setRoleLabel(null)
        setPermissions([])
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadAccess()
    return () => { active = false }
  }, [user?.email, user?.uid])

  const can = useMemo(() => (permission: string) => permissions.includes('*') || permissions.includes(permission), [permissions])
  return { isAdmin, loading, roleKey, roleLabel, permissions, can }
}
