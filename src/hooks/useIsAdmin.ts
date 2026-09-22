import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase'

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
        const idToken = await auth.currentUser?.getIdToken()
        if (!idToken) throw new Error('Firebase session unavailable')
        const response = await fetch('/api/admin-access', { headers: { Authorization: `Bearer ${idToken}` } })
        const payload = await response.json().catch(() => ({})) as { data?: unknown; error?: string }
        if (!response.ok) throw new Error(payload.error || `Admin access failed (HTTP ${response.status})`)
        if (!active) return
        const access = payload.data as { is_admin?: boolean; role_key?: string; role_label?: string; permissions?: unknown } | null
        if (access?.is_admin) {
          const raw = access.permissions
          setIsAdmin(true)
          setRoleKey(access.role_key ?? null)
          setRoleLabel(access.role_label ?? null)
          setPermissions(Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [])
          return
        }

        setIsAdmin(false)
        setRoleKey(null)
        setRoleLabel(null)
        setPermissions([])
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
