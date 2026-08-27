import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { BrandLoader } from '@/components/BrandLoader'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <BrandLoader fullScreen message="আপনার অ্যাকাউন্ট প্রস্তুত হচ্ছে…" />
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    if (returnTo !== '/login') window.sessionStorage.setItem('bikrikoro:auth-return-to', returnTo)
    return <Navigate to="/login" state={{ from: returnTo }} replace />
  }

  return <>{children}</>
}
