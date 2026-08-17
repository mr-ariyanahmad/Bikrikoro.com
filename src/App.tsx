import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminRoute } from '@/components/AdminRoute'
import { useEnsureProfile } from '@/hooks/useEnsureProfile'
import Login from '@/pages/Login'
import ForgotPassword from '@/pages/ForgotPassword'
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
import PrivacyPolicy from '@/pages/PrivacyPolicy'
import AboutUs from '@/pages/AboutUs'
import ContactUs from '@/pages/ContactUs'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminDisputes from '@/pages/admin/AdminDisputes'
import AdminSellerVerifications from '@/pages/admin/AdminSellerVerifications'

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
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/about" element={<AboutUs />} />
      <Route path="/contact" element={<ContactUs />} />
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
