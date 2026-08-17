import { Navigate, useLocation } from 'react-router-dom'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { permissionForAdminPath } from '@/lib/adminPermissions'

export function AdminRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { isAdmin, loading, can } = useIsAdmin()
  const location = useLocation()
  const requiredPermission = permission ?? permissionForAdminPath(location.pathname)
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-bg"><div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>
  if (!isAdmin) return <Navigate to="/" replace />
  if (!can(requiredPermission)) return <Navigate to="/admin" replace />
  return <>{children}</>
}
