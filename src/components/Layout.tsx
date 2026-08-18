import { type ComponentType, type ReactNode, useEffect, useState } from 'react'
import { Bell, BookOpen, BookmarkPlus, ChevronDown, Heart, Home, LogOut, MapPin, Menu, MessageCircle, Package, Settings2, ShoppingBag, Store, UserRound, WalletCards, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useIsSeller } from '@/hooks/useIsSeller'
import { SearchBar } from '@/components/SearchBar'
import { BackButton } from '@/components/BackButton'
import { loadUnreadNotificationCount } from '@/lib/marketplace'
import { supabase } from '@/lib/supabase'

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
type NavItem = { to: string; label: string; icon: Icon }

const NAV_LINKS: NavItem[] = [
  { to: '/', label: 'হোম', icon: Home },
  { to: '/products', label: 'প্রোডাক্ট', icon: ShoppingBag },
  { to: '/compare', label: 'তুলনা', icon: Package },
  { to: '/become-seller', label: 'বিক্রি করুন', icon: WalletCards },
  { to: '/orders', label: 'অর্ডার', icon: Package },
  { to: '/blog', label: 'গাইড', icon: BookOpen },
]
const ACCOUNT_LINKS: NavItem[] = [
  { to: '/library', label: 'ডিজিটাল লাইব্রেরি', icon: Package },
  { to: '/notifications', label: 'নোটিফিকেশন', icon: Bell },
  { to: '/chat', label: 'চ্যাট', icon: MessageCircle },
  { to: '/wallet', label: 'ওয়ালেট', icon: WalletCards },
  { to: '/addresses', label: 'সেভড ঠিকানা', icon: MapPin },
  { to: '/saved-searches', label: 'সেভড সার্চ', icon: BookmarkPlus },
  { to: '/settings', label: 'Settings ও Help', icon: Settings2 },
  { to: '/account', label: 'অ্যাকাউন্ট', icon: UserRound },
]
const CITIES = ['খুলনা', 'ঢাকা', 'চট্টগ্রাম', 'সারা বাংলাদেশ']

export function Layout({ children, wide = false, backFallback = '/', backLabel = 'ফিরে যান' }: { children: ReactNode; wide?: boolean; backFallback?: string; backLabel?: string }) {
  const { user, logout, loading: authLoading } = useAuth()
  const { isAdmin } = useIsAdmin()
  const { isSeller, loading: sellerLoading } = useIsSeller()
  const [menuOpen, setMenuOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const sellerStatusLoading = authLoading || Boolean(user && sellerLoading)
  const navLinks = (isAdmin ? [...NAV_LINKS, { to: '/admin', label: 'অ্যাডমিন', icon: UserRound }] : NAV_LINKS)
    .filter((item) => !(item.to === '/become-seller' && sellerStatusLoading))
    .map((item) => item.to === '/become-seller' && isSeller ? { ...item, to: '/seller/dashboard', label: 'সেলার অ্যাকাউন্ট', icon: Store } : item)
  const maxWidth = wide ? 'max-w-7xl' : 'max-w-3xl'

  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    let active = true
    void loadUnreadNotificationCount(user.uid).then((count) => { if (active) setUnreadCount(count) }).catch(() => undefined)
    const onChanged = (event: Event) => {
      const count = (event as CustomEvent<{ unreadCount?: number }>).detail?.unreadCount
      if (typeof count === 'number') setUnreadCount(count)
    }
    const channel = supabase
      .channel(`header-notifications-${user.uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.uid}` }, () => setUnreadCount((count) => count + 1))
      .subscribe()
    window.addEventListener('bikrikoro-notifications-changed', onChanged)
    return () => {
      active = false
      window.removeEventListener('bikrikoro-notifications-changed', onChanged)
      void supabase.removeChannel(channel)
    }
  }, [user])

  return (
    <div className="site-minimal min-h-screen bg-bg text-ink-900">
      <header className="sticky top-0 z-40 border-b border-outline/80 bg-surface/95 shadow-[0_2px_16px_rgba(15,23,42,0.04)] backdrop-blur">
        <div className={`mx-auto ${maxWidth} px-4 sm:px-5`}>
          <div className="flex min-h-[4.5rem] items-center gap-3 sm:gap-5">
            <Link to="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setMenuOpen(false)}>
              <img src="/icon-512.png" alt="BikriKoro" className="h-10 w-10 rounded-xl shadow-sm" />
              <span className="hidden text-[15px] font-bold tracking-tight text-ink-900 sm:inline">BikriKoro<span className="text-brand-600">.Com</span></span>
            </Link>

            <div className="hidden min-w-0 flex-1 sm:block"><SearchBar /></div>

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <div className="relative hidden md:block">
                <button type="button" onClick={() => setCityOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-xl border border-outline bg-bg px-3 py-2 text-sm font-medium text-ink-700 hover:border-brand-300 hover:text-brand-700" aria-expanded={cityOpen}>
                  <MapPin size={16} className="text-brand-600" /><span>খুলনা</span><ChevronDown size={14} className={cityOpen ? 'rotate-180 transition' : 'transition'} />
                </button>
                {cityOpen && <div className="absolute right-0 top-12 z-50 w-44 rounded-2xl border border-outline bg-surface p-1.5 shadow-xl">{CITIES.map((city) => <Link key={city} to={`/products?location=${encodeURIComponent(city)}`} onClick={() => setCityOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-700"><MapPin size={14} />{city}</Link>)}</div>}
              </div>
              {user && <Link to="/favorites" className="hidden rounded-xl p-2 text-ink-500 hover:bg-red-50 hover:text-red-500 sm:block" aria-label="পছন্দের তালিকা"><Heart size={20} strokeWidth={1.8} /></Link>}
              {user ? <Link to="/account" className="hidden items-center gap-2 rounded-xl border border-outline px-3 py-2 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700 sm:flex"><UserRound size={16} />অ্যাকাউন্ট</Link> : <Link to="/login" className="rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 sm:px-4">লগইন</Link>}
              <button type="button" onClick={() => setMenuOpen((open) => !open)} className="rounded-xl border border-outline p-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 md:hidden" aria-label={menuOpen ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
            </div>
          </div>

          <div className="border-t border-outline/70 py-2.5 sm:hidden"><SearchBar compact /></div>

          <nav className="hidden items-center justify-between border-t border-outline/70 py-2 md:flex">
            <div className="flex items-center gap-1">{navLinks.map((link) => <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => `group inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-bg hover:text-ink-900'}`}><link.icon size={15} strokeWidth={1.8} /><span>{link.label}</span></NavLink>)}</div>
            <div className="flex items-center gap-1.5"><Link to="/settings" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-600 hover:bg-bg hover:text-brand-700"><Settings2 size={15} className="text-brand-600" />Settings ও Help</Link><div className="relative"><button type="button" onClick={() => setCityOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-600 hover:bg-bg hover:text-brand-700"><MapPin size={15} className="text-brand-600" />খুলনা<ChevronDown size={13} /></button></div><Link to="/notifications" className="relative rounded-xl p-2 text-ink-500 hover:bg-brand-50 hover:text-brand-700" aria-label="নোটিফিকেশন"><Bell size={17} />{user && unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-bold leading-4 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}</Link></div>
          </nav>

          {menuOpen && <nav className="border-t border-outline bg-surface py-3 md:hidden"><div className="grid grid-cols-2 gap-1.5">{navLinks.map((link) => <MobileNavLink key={link.to} item={link} onClose={() => setMenuOpen(false)} />)}</div><div className="my-3 h-px bg-outline" /><div className="grid grid-cols-2 gap-1.5">{user ? ACCOUNT_LINKS.map((link) => <MobileNavLink key={link.to} item={link} onClose={() => setMenuOpen(false)} />) : <Link to="/login" onClick={() => setMenuOpen(false)} className="col-span-2 rounded-xl bg-brand-50 px-3 py-2.5 text-center text-sm font-semibold text-brand-700">লগইন করে সব সুবিধা ব্যবহার করুন</Link>}{user && <button type="button" onClick={() => { setMenuOpen(false); logout() }} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600"><LogOut size={16} />লগআউট</button>}</div></nav>}
        </div>
      </header>
      <main className={`mx-auto ${maxWidth} px-4 py-7 sm:px-5 sm:py-8`}><BackButton fallbackTo={backFallback} label={backLabel} />{children}</main>
      <footer className="border-t border-outline bg-surface"><div className={`mx-auto ${maxWidth} flex flex-col items-center gap-3 px-5 py-7 text-xs text-ink-300 sm:flex-row sm:justify-between`}><span>© {new Date().getFullYear()} Bikrikoro.Com</span><div className="flex gap-4"><Link to="/settings" className="hover:text-ink-600">Settings ও Help</Link><Link to="/help" className="hover:text-ink-600">সাহায্য</Link></div></div></footer>
    </div>
  )
}

function MobileNavLink({ item, onClose }: { item: NavItem; onClose: () => void }) { return <NavLink to={item.to} end={item.to === '/'} onClick={onClose} className={({ isActive }) => `flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-bg'}`}><item.icon size={17} strokeWidth={1.8} />{item.label}</NavLink> }
