import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import Account from '@/pages/Account'
import SellerProfile from '@/pages/SellerProfile'
import SellerDashboard from '@/pages/SellerDashboard'
import Favorites from '@/pages/Favorites'
import SettingsHub from '@/pages/SettingsHub'
import PublicContentPage from '@/pages/PublicContentPage'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminOrders from '@/pages/admin/AdminOrders'
import AdminDeliveries from '@/pages/admin/AdminDeliveries'
import AdminCustomers from '@/pages/admin/AdminCustomers'
import AdminCoupons from '@/pages/admin/AdminCoupons'
import AdminCatalogue from '@/pages/admin/AdminCatalogue'
import AdminReviews from '@/pages/admin/AdminReviews'
import AdminContent from '@/pages/admin/AdminContent'
import AdminSettings from '@/pages/admin/AdminSettings'
import AdminSystemStatus from '@/pages/admin/AdminSystemStatus'
import AdminFinance from '@/pages/admin/AdminFinance'
import AdminSupport from '@/pages/admin/AdminSupport'

import AdminDisputes from '@/pages/admin/AdminDisputes'
import AdminSellerVerifications from '@/pages/admin/AdminSellerVerifications'
import AdminFeatureControls from '@/pages/admin/AdminFeatureControls'

function AppRoutes() {
  useEnsureProfile()

  return (
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
              <AdminSupport />
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
  )
}

export default function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  )
}
