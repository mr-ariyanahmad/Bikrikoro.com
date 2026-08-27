import { Navigate, useLocation } from 'react-router-dom'
import { useIsSeller } from '@/hooks/useIsSeller'
import { BrandLoader } from '@/components/BrandLoader'

export function SellerRoute({ children }: { children: React.ReactNode }) {
  const { isSeller, loading } = useIsSeller()
  const location = useLocation()

  if (loading) return <BrandLoader fullScreen message="সেলার অ্যাকাউন্ট যাচাই হচ্ছে…" />
  if (!isSeller) return <Navigate to="/become-seller" state={{ from: `${location.pathname}${location.search}${location.hash}` }} replace />
  return <>{children}</>
}
