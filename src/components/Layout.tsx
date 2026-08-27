import { type ComponentType, type ReactNode, useEffect, useState } from 'react'
import { Bell, BookOpen, BookmarkPlus, ChevronDown, Heart, Home, LogOut, MapPin, Menu, MessageCircle, Package, Plus, Settings2, ShoppingBag, Store, UserRound, WalletCards, X } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useIsSeller } from '@/hooks/useIsSeller'
import { SearchBar } from '@/components/SearchBar'
import { BackButton } from '@/components/BackButton'
import { loadUnreadNotificationCount } from '@/lib/marketplace'
import { supabase } from '@/lib/supabase'

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
type NavItem = { to: string; label: string; icon: Icon }
type MobileQuickNavItem = NavItem & { prominent?: boolean }

const NAV_LINKS: NavItem[] = [
  { to: '/', label: 'হোম', icon: Home },
  { to: '/products', label: 'প্রোডাক্ট', icon: ShoppingBag },
  { to: '/compare', label: 'তুলনা', icon: Package },
  { to: '/become-seller', label: 'বিক্রি করুন', icon: WalletCards },
  { to: '/orders', label: 'অর্ডার', icon: Package },
  { to: '/blog', label: 'গাইড', icon: BookOpen },
]
const ACCOUNT_LINKS: NavItem[] = [
  { to: '/favorites', label: 'পছন্দের তালিকা', icon: Heart },
  { to: '/library', label: 'ডিজিটাল লাইব্রেরি', icon: Package },
  { to: '/notifications', label: 'নোটিফিকেশন', icon: Bell },
  { to: '/chat', label: 'চ্যাট', icon: MessageCircle },
  { to: '/wallet', label: 'ওয়ালেট', icon: WalletCards },
  { to: '/saved-searches', label: 'সেভড সার্চ', icon: BookmarkPlus },
  { to: '/settings', label: 'সেটিংস ও সহায়তা', icon: Settings2 },
  { to: '/account', label: 'অ্যাকাউন্ট', icon: UserRound },
]
const CITIES = ['খুলনা', 'ঢাকা', 'চট্টগ্রাম', 'সারা বাংলাদেশ']

export function Layout({ children, wide = false, backFallback = '/', backLabel = 'ফিরে যান', hideFooter = false, fullScreen = false, hideMobileQuickNav = false }: { children: ReactNode; wide?: boolean; backFallback?: string; backLabel?: string; hideFooter?: boolean; fullScreen?: boolean; hideMobileQuickNav?: boolean }) {
  const location = useLocation()
  const { user, logout, loading: authLoading } = useAuth()
  const { isAdmin } = useIsAdmin()
  const { isSeller, loading: sellerLoading } = useIsSeller()
  const [menuOpen, setMenuOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const sellerStatusLoading = authLoading || Boolean(user && sellerLoading)
  const navLinks = (isAdmin ? [...NAV_LINKS, { to: '/admin', label: 'অ্যাডমিন', icon: UserRound }] : NAV_LINKS)
    .filter((item) => !(item.to === '/become-seller' && sellerStatusLoading))
    .map((item) => item.to === '/become-seller' && isSeller ? { ...item, to: '/seller/dashboard', label: 'সেলার অ্যাকাউন্ট', icon: Store } : item)
  const mobileQuickLinks: MobileQuickNavItem[] = [
    { to: '/', label: 'হোম', icon: Home },
    { to: '/orders', label: 'অর্ডার', icon: Package },
    { to: isSeller ? '/sell' : '/become-seller', label: 'পোস্ট', icon: Plus, prominent: true },
    { to: '/chat', label: 'চ্যাট', icon: MessageCircle },
    { to: '/account', label: 'অ্যাকাউন্ট', icon: UserRound },
  ]
  const maxWidth = wide ? 'max-w-7xl' : 'max-w-3xl'
  // Every mobile page uses the compact home-style search in the primary header.
  // The dedicated /search route already owns its full-screen search input.
  const showPrimaryMobileSearch = location.pathname !== '/search'
  const closeMobileMenu = () => { setMenuOpen(false); setCityOpen(false) }
  const toggleMobileMenu = () => { setAccountOpen(false); setMenuOpen((open) => !open) }
  const toggleAccountMenu = () => { setMenuOpen(false); setAccountOpen((open) => !open) }

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

  useEffect(() => {
    if (!fullScreen) return
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
    }
  }, [fullScreen])

  return (
    <div className={`site-minimal bg-bg text-ink-900 ${fullScreen ? 'flex h-[100dvh] min-h-0 flex-col overflow-hidden' : 'min-h-screen'}`}>
      <header className={`sticky top-0 z-40 border-b border-outline/80 bg-surface/95 shadow-[0_2px_16px_rgba(15,23,42,0.04)] backdrop-blur ${fullScreen ? 'shrink-0' : ''}`}>
        <div className={`mx-auto ${maxWidth} px-4 sm:px-5`}>
          <div className="flex min-h-[4.5rem] items-center gap-3 sm:gap-5">
            <Link to="/" className="flex shrink-0 items-center gap-2.5" onClick={() => setMenuOpen(false)}>
              <img src="/icon-512.png" alt="BikriKoro" className="h-10 w-10 rounded-xl shadow-sm" />
              <span className="hidden text-[15px] font-bold tracking-tight text-ink-900 sm:inline">BikriKoro<span className="text-brand-600">.Com</span></span>
            </Link>

            <div className="hidden shrink-0 sm:block"><BackButton fallbackTo={backFallback} label={backLabel} /></div>
            <div className="hidden min-w-0 flex-1 sm:block"><SearchBar /></div>
            {showPrimaryMobileSearch && <div className="min-w-0 flex-1 sm:hidden"><SearchBar compact /></div>}

            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <div className="relative hidden md:block">
                <button type="button" onClick={() => setCityOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-xl border border-outline bg-bg px-3 py-2 text-sm font-medium text-ink-700 hover:border-brand-300 hover:text-brand-700" aria-expanded={cityOpen}>
                  <MapPin size={16} className="text-brand-600" /><span>খুলনা</span><ChevronDown size={14} className={cityOpen ? 'rotate-180 transition' : 'transition'} />
                </button>
                {cityOpen && <div className="absolute right-0 top-12 z-50 w-44 rounded-2xl border border-outline bg-surface p-1.5 shadow-xl">{CITIES.map((city) => <Link key={city} to={`/products?location=${encodeURIComponent(city)}`} onClick={() => setCityOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-700"><MapPin size={14} />{city}</Link>)}</div>}
              </div>
              {user ? <div className="relative hidden md:block">
                <button type="button" onClick={toggleAccountMenu} className="inline-flex items-center gap-2 rounded-xl border border-outline px-3 py-2 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700" aria-expanded={accountOpen} aria-haspopup="menu"><UserRound size={16} />অ্যাকাউন্ট<ChevronDown size={14} className={accountOpen ? 'rotate-180 transition' : 'transition'} /></button>
                {accountOpen && <div role="menu" className="absolute right-0 top-12 z-50 w-60 rounded-2xl border border-outline bg-surface p-1.5 shadow-xl">{ACCOUNT_LINKS.map((link) => <Link key={link.to} to={link.to} role="menuitem" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"><link.icon size={16} /><span className="min-w-0 flex-1">{link.label}</span>{link.to === '/notifications' && unreadCount > 0 && <span className="min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[10px] font-bold leading-5 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}</Link>)}<div className="my-1 h-px bg-outline" /><button type="button" onClick={() => { setAccountOpen(false); void logout() }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50" role="menuitem"><LogOut size={16} />লগআউট</button></div>}
              </div> : <Link to="/login" className="rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 sm:px-4">লগইন</Link>}
              <button type="button" onClick={toggleMobileMenu} className="rounded-xl border border-outline p-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 md:hidden" aria-label={menuOpen ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'} aria-expanded={menuOpen}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
            </div>
          </div>

          <nav className="hidden items-center justify-between border-t border-outline/70 py-2 md:flex">
            <div className="flex items-center gap-1">{navLinks.map((link) => <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => `group inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-bg hover:text-ink-900'}`}><link.icon size={15} strokeWidth={1.8} /><span>{link.label}</span></NavLink>)}</div>
            <div className="flex items-center gap-1.5"><Link to="/settings" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-600 hover:bg-bg hover:text-brand-700"><Settings2 size={15} className="text-brand-600" />সেটিংস ও সহায়তা</Link><div className="relative"><button type="button" onClick={() => setCityOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-600 hover:bg-bg hover:text-brand-700"><MapPin size={15} className="text-brand-600" />খুলনা<ChevronDown size={13} /></button></div><Link to="/notifications" className="relative rounded-xl p-2 text-ink-500 hover:bg-brand-50 hover:text-brand-700" aria-label="নোটিফিকেশন"><Bell size={17} />{user && unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-bold leading-4 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}</Link></div>
          </nav>

          {menuOpen && <nav className="border-t border-outline bg-surface py-3 md:hidden"><div className="grid grid-cols-2 gap-1.5">{navLinks.map((link) => <MobileNavLink key={link.to} item={link} onClose={closeMobileMenu} />)}</div><div className="relative mt-3"><button type="button" onClick={() => setCityOpen((open) => !open)} className="flex w-full items-center justify-between rounded-xl border border-outline bg-bg px-3 py-2.5 text-sm font-semibold text-ink-700"><span className="inline-flex items-center gap-2"><MapPin size={16} className="text-brand-600" />এলাকা: খুলনা</span><ChevronDown size={14} className={cityOpen ? 'rotate-180 transition' : 'transition'} /></button>{cityOpen && <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl border border-outline bg-bg p-1">{CITIES.map((city) => <Link key={city} to={`/products?location=${encodeURIComponent(city)}`} onClick={closeMobileMenu} className="rounded-lg px-2.5 py-2 text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-700">{city}</Link>)}</div>}</div><div className="my-3 h-px bg-outline" />{user ? <div className="grid grid-cols-2 gap-1.5">{ACCOUNT_LINKS.map((link) => <MobileNavLink key={link.to} item={link} badge={link.to === '/notifications' ? unreadCount : undefined} onClose={closeMobileMenu} />)}<button type="button" onClick={() => { closeMobileMenu(); void logout() }} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600"><LogOut size={16} />লগআউট</button></div> : <Link to="/login" onClick={closeMobileMenu} className="rounded-xl bg-brand-50 px-3 py-2.5 text-center text-sm font-semibold text-brand-700">লগইন করে সব সুবিধা ব্যবহার করুন</Link>}</nav>}
        </div>
      </header>
      <main className={fullScreen ? `mx-auto ${maxWidth} flex min-h-0 w-full flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5 sm:py-5` : `mx-auto ${maxWidth} px-4 pb-28 pt-7 sm:px-5 sm:pt-8 md:py-8`}>{children}</main>
      {!hideFooter && <footer className="border-t border-outline bg-surface pb-24 md:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-5 sm:py-9">
          <section className="border border-outline bg-bg p-3 sm:p-4" aria-label="পেমেন্ট পদ্ধতি"><img src="/payment-logos/payment-options.png" alt="BikriKoro payment options" className="mx-auto h-auto w-full max-w-5xl object-contain" loading="lazy" /></section>
          <div className="flex flex-col items-center gap-3 pt-6 text-sm text-ink-400 sm:flex-row sm:justify-between"><span>© {new Date().getFullYear()} Bikrikoro.Com</span><div className="flex gap-4"><Link to="/settings" className="hover:text-ink-700">সেটিংস ও সহায়তা</Link><Link to="/help" className="hover:text-ink-700">সাহায্য</Link></div></div>
        </div>
      </footer>}
      {!fullScreen && !hideMobileQuickNav && <nav aria-label="মোবাইল কুইক নেভিগেশন" className="fixed inset-x-3 bottom-3 z-50 rounded-[1.6rem] border border-white/80 bg-surface/95 shadow-[0_14px_34px_rgba(15,23,42,0.18)] backdrop-blur-xl md:hidden"><div className="mx-auto grid max-w-xl grid-cols-5 items-end px-1.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2.5">{mobileQuickLinks.map((link) => <NavLink key={link.label} to={link.to} end={link.to === '/'} onClick={closeMobileMenu} className={({ isActive }) => `relative flex min-h-14 min-w-0 flex-col items-center justify-end gap-1 rounded-2xl px-1 pb-1.5 text-[10px] font-bold transition active:scale-[0.97] ${link.prominent ? 'text-brand-700' : isActive ? 'bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px_rgba(1,124,80,0.10)]' : 'text-ink-500 hover:bg-bg hover:text-ink-800'}`}><span className={link.prominent ? '-mt-8 flex h-14 w-14 items-center justify-center rounded-[1.15rem] border-4 border-surface bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_10px_22px_rgba(1,124,80,0.32)]' : 'flex h-6 items-center justify-center'}><link.icon size={link.prominent ? 25 : 20} strokeWidth={link.prominent ? 2.6 : 1.9} /></span><span className="max-w-full truncate">{link.label}</span></NavLink>)}</div></nav>}
    </div>
  )
}

function MobileNavLink({ item, badge = 0, onClose }: { item: NavItem; badge?: number; onClose: () => void }) { return <NavLink to={item.to} end={item.to === '/'} onClick={onClose} className={({ isActive }) => `flex min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-bg'}`}><item.icon size={17} strokeWidth={1.8} /><span className="min-w-0 flex-1 truncate">{item.label}</span>{badge > 0 && <span className="min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[10px] font-bold leading-5 text-white">{badge > 99 ? '99+' : badge}</span>}</NavLink> }
