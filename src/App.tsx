import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminRoute } from '@/components/AdminRoute'
import { useEnsureProfile } from '@/hooks/useEnsureProfile'
import Login from '@/pages/Login'
import ForgotPassword from '@/pages/ForgotPassword'
import SavedAddresses from '@/pages/SavedAddresses'
import SavedSearches from '@/pages/SavedSearches'
import Home from '@/pages/Home'
import Products from '@/pages/Products'
import ProductDetail from '@/pages/ProductDetail'
import Compare from '@/pages/Compare'
import Library from '@/pages/Library'
import Notifications from '@/pages/Notifications'
import Sell from '@/pages/Sell'
import BecomeSeller from '@/pages/BecomeSeller'
import SellerVerification from '@/pages/SellerVerification'
import MyListings from '@/pages/MyListings'
import Orders from '@/pages/Orders'
import PaymentCallback from '@/pages/PaymentCallback'
import OrderDetail from '@/pages/OrderDetail'
import DisputeThread from '@/pages/DisputeThread'
import ChatList from '@/pages/ChatList'
import ChatThread from '@/pages/ChatThread'
import Wallet from '@/pages/Wallet'
import RewardsHub from '@/pages/RewardsHub'
import Account from '@/pages/Account'
import SellerProfile from '@/pages/SellerProfile'
import SellerDashboard from '@/pages/SellerDashboard'
import Favorites from '@/pages/Favorites'
import SettingsHub from '@/pages/SettingsHub'
import PublicContentPage from '@/pages/PublicContentPage'
import Blog from '@/pages/Blog'
import BlogPost from '@/pages/BlogPost'
import { FirstVisitSplash } from '@/components/FirstVisitSplash'
import { SiteMeta } from '@/components/SiteMeta'
import { ConfigurationNotice } from '@/components/ConfigurationNotice'

const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'))
const AdminDeliveries = lazy(() => import('@/pages/admin/AdminDeliveries'))
const AdminCustomers = lazy(() => import('@/pages/admin/AdminCustomers'))
const AdminCustomerDetail = lazy(() => import('@/pages/admin/AdminCustomerDetail'))
const AdminCoupons = lazy(() => import('@/pages/admin/AdminCoupons'))
const AdminCatalogue = lazy(() => import('@/pages/admin/AdminCatalogue'))
const AdminReviews = lazy(() => import('@/pages/admin/AdminReviews'))
const AdminContent = lazy(() => import('@/pages/admin/AdminContent'))
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'))
const AdminSystemStatus = lazy(() => import('@/pages/admin/AdminSystemStatus'))
const AdminFinance = lazy(() => import('@/pages/admin/AdminFinance'))
const AdminSupport = lazy(() => import('@/pages/admin/AdminSupport'))
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'))
const AdminDisputes = lazy(() => import('@/pages/admin/AdminDisputes'))
const AdminSellerVerifications = lazy(() => import('@/pages/admin/AdminSellerVerifications'))
const AdminFeatureControls = lazy(() => import('@/pages/admin/AdminFeatureControls'))
const AdminTeam = lazy(() => import('@/pages/admin/AdminTeam'))

function AppRoutes() {
  useEnsureProfile()

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-bg"><div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/" element={<Home />} />
      <Route path="/products" element={<Products />} />
      <Route path="/products/:id" element={<ProductDetail />} />
      <Route path="/compare" element={<Compare />} />
      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <Library />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route path="/become-seller" element={<BecomeSeller />} />
      <Route
        path="/become-seller/verify"
        element={
          <ProtectedRoute>
            <SellerVerification />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sell"
        element={
          <ProtectedRoute>
            <Sell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sell/:id"
        element={
          <ProtectedRoute>
            <Sell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-listings"
        element={
          <ProtectedRoute>
            <MyListings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/payment-callback"
        element={
          <ProtectedRoute>
            <PaymentCallback />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <ProtectedRoute>
            <OrderDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/disputes/:disputeId"
        element={
          <ProtectedRoute>
            <DisputeThread />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:threadId"
        element={
          <ProtectedRoute>
            <ChatThread />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <Wallet />
          </ProtectedRoute>
        }
      />
      <Route
        path="/rewards"
        element={
          <ProtectedRoute>
            <RewardsHub />
          </ProtectedRoute>
        }
      />
      <Route path="/seller/:username" element={<SellerProfile />} />
      <Route path="/sellers/:id" element={<SellerProfile />} />
      <Route path="/settings" element={<SettingsHub />} />
      <Route path="/help" element={<PublicContentPage type="HELP" />} />
      <Route path="/faq" element={<PublicContentPage type="FAQ" />} />
      <Route path="/user-education" element={<PublicContentPage type="USER_EDU" />} />
      <Route path="/seller-education" element={<PublicContentPage type="SELLER_EDU" />} />
      <Route path="/return-policy" element={<PublicContentPage type="RETURN_POLICY" />} />
      <Route path="/terms" element={<PublicContentPage type="TERMS" />} />
      <Route path="/privacy" element={<PublicContentPage type="PRIVACY" />} />
      <Route path="/about" element={<PublicContentPage type="ABOUT" />} />
      <Route path="/contact" element={<PublicContentPage type="CONTACT" />} />
      <Route path="/blog" element={<Blog />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route
        path="/saved-searches"
        element={
          <ProtectedRoute>
            <SavedSearches />
          </ProtectedRoute>
        }
      />
      <Route
        path="/addresses"
        element={
          <ProtectedRoute>
            <SavedAddresses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <Account />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/dashboard"
        element={
          <ProtectedRoute>
            <SellerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/favorites"
        element={
          <ProtectedRoute>
            <Favorites />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/orders/:id"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminOrders />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminOrders />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/deliveries"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminDeliveries />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/customers"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminCustomers />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/customers/:id"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminCustomerDetail />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/coupons"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminCoupons />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminFinance />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/support"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminSupport />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/notifications"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminNotifications />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/products"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminCatalogue />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminCatalogue mode="categories" />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/industries"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminCatalogue mode="industries" />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reviews"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminReviews />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/gallery"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminContent mode="gallery" />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/downloads"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminContent mode="downloads" />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/blog"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminContent mode="blog" />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/faq"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminContent mode="faq" />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/pages"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminContent mode="pages" />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/features"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminFeatureControls />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/team"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminTeam />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/invoice-settings"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminSettings mode="invoice" />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/site-settings"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminSettings mode="site" />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/system-status"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminSystemStatus />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/disputes"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminDisputes />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/sellers"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminSellerVerifications />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <SiteMeta />
          <ConfigurationNotice />
          <FirstVisitSplash>
            <AppRoutes />
          </FirstVisitSplash>
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  )
}
