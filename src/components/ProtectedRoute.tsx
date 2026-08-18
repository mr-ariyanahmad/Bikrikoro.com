import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    if (returnTo !== '/login') window.sessionStorage.setItem('bikrikoro:auth-return-to', returnTo)
    return <Navigate to="/login" state={{ from: returnTo }} replace />
  }

  return <>{children}</>
}
