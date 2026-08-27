import { Navigate, useLocation } from 'react-router-dom'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { permissionForAdminPath } from '@/lib/adminPermissions'
import { BrandLoader } from '@/components/BrandLoader'

export function AdminRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { isAdmin, loading, can } = useIsAdmin()
  const location = useLocation()
  const requiredPermission = permission ?? permissionForAdminPath(location.pathname)
  if (loading) return <BrandLoader fullScreen message="অ্যাডমিন অ্যাক্সেস প্রস্তুত হচ্ছে…" />
  if (!isAdmin) return <Navigate to="/" replace />
  if (!can(requiredPermission)) return <Navigate to="/admin" replace />
  return <>{children}</>
}
