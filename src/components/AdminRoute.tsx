import { Navigate } from 'react-router-dom'
import { useIsAdmin } from '@/hooks/useIsAdmin'

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading } = useIsAdmin()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!isAdmin) return <Navigate to="/" replace />

  return <>{children}</>
}
