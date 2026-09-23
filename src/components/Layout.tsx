import { type ComponentType, type ReactNode, useEffect, useState } from 'react'
import { Bell, BookOpen, BookmarkPlus, ChevronDown, Heart, Home, LogOut, MapPin, Menu, MessageCircle, Package, Plus, Settings2, ShoppingBag, Store, UserRound, WalletCards, X, ShieldCheck, CreditCard, BarChart3, CircleHelp, LockKeyhole } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useIsSeller } from '@/hooks/useIsSeller'
import { BackButton } from '@/components/BackButton'
import { loadUnreadNotificationCount, loadUnreadOrderNotificationCount } from '@/lib/marketplace'
import { chatRequest } from '@/lib/chat'
import { adminRpc } from '@/lib/adminRpc'
import { supabase } from '@/lib/supabase'

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
type NavItem = { to: string; label: string; icon: Icon }
type MobileQuickNavItem = NavItem & { prominent?: boolean }

const NAV_LINKS: NavItem[] = [
  { to: '/', label: 'হোম', icon: Home },
  { to: '/products', label: 'প্রোডাক্ট', icon: ShoppingBag },
  { to: '/compare', label: 'তুলনা', icon: Package },
  { to: '/become-seller', label: 'সেলার হোন', icon: Store },
  { to: '/orders', label: 'অর্ডার', icon: Package },
  { to: '/blog', label: 'গাইড', icon: BookOpen },
]
const ACCOUNT_LINKS: NavItem[] = [
  { to: '/account', label: 'অ্যাকাউন্ট', icon: UserRound },
  { to: '/payment-accounts', label: 'পেমেন্ট অ্যাকাউন্ট', icon: WalletCards },
  { to: '/notifications', label: 'নোটিফিকেশন', icon: Bell },
  { to: '/chat', label: 'চ্যাট', icon: MessageCircle },
  { to: '/favorites', label: 'পছন্দের তালিকা', icon: Heart },
  { to: '/library', label: 'ডিজিটাল লাইব্রেরি', icon: Package },
  { to: '/saved-searches', label: 'সেভড সার্চ', icon: BookmarkPlus },
  { to: '/settings', label: 'সেটিংস', icon: Settings2 },
]
const DRAWER_LINKS: NavItem[] = [
  { to: '/payment-accounts', label: 'পেমেন্ট অ্যাকাউন্ট', icon: CreditCard },
  { to: '/become-seller', label: 'সেলার সেন্টার', icon: Store },
  { to: '/seller/dashboard', label: 'লিস্টিং বিশ্লেষণ', icon: BarChart3 },
  { to: '/help', label: 'সাহায্য ও সাপোর্ট', icon: CircleHelp },
  { to: '/privacy', label: 'গোপনীয়তা ও নিরাপত্তা', icon: LockKeyhole },
  { to: '/settings', label: 'সেটিংস', icon: Settings2 },
]
const CITIES = ['খুলনা', 'ঢাকা', 'চট্টগ্রাম', 'সারা বাংলাদেশ']

function pageTitle(pathname: string) {
  if (pathname === '/') return 'হোম'
  if (pathname === '/chat/support') return 'কাস্টমার কেয়ার'
  if (pathname === '/chat' || pathname.startsWith('/chat/')) return 'চ্যাট'
  if (pathname === '/orders' || pathname.startsWith('/orders/')) return pathname.includes('payment-callback') ? 'পেমেন্ট' : 'অর্ডার'
  if (pathname === '/products' || pathname.startsWith('/products/')) return pathname.startsWith('/products/') ? 'প্রোডাক্ট বিস্তারিত' : 'প্রোডাক্ট'
  if (pathname.startsWith('/admin')) return 'অ্যাডমিন প্যানেল'
  if (pathname === '/account' || pathname.startsWith('/account/')) return 'অ্যাকাউন্ট'
  if (pathname === '/seller/dashboard') return 'সেলার ড্যাশবোর্ড'
  if (pathname.startsWith('/seller/')) return 'সেলার প্রোফাইল'
  if (pathname === '/wallet' || pathname === '/payment-accounts') return 'পেমেন্ট অ্যাকাউন্ট'
  if (pathname === '/notifications') return 'নোটিফিকেশন'
  if (pathname === '/favorites') return 'পছন্দের তালিকা'
  if (pathname === '/library') return 'ডিজিটাল লাইব্রেরি'
  if (pathname === '/settings') return 'সেটিংস'
  if (pathname === '/search') return 'সার্চ'
  if (pathname === '/compare') return 'তুলনা'
  if (pathname === '/sell' || pathname.startsWith('/sell/')) return 'বিক্রি করুন'
  if (pathname === '/become-seller') return 'সেলার হোন'
  if (pathname.startsWith('/disputes/')) return 'অভিযোগ'
  if (pathname === '/blog' || pathname.startsWith('/blog/')) return 'গাইড'
  if (pathname === '/help' || pathname === '/faq' || pathname === '/contact') return 'সাহায্য ও সাপোর্ট'
  return 'BikriKoro'
}

export function Layout({ children, wide = false, backFallback = '/', backLabel = 'ফিরে যান', hideFooter = false, fullScreen = false, fullWidth = false, hideMobileQuickNav = false, hideMobileHeader = false, mobileBottomBar = false }: { children: ReactNode; wide?: boolean; backFallback?: string; backLabel?: string; hideFooter?: boolean; fullScreen?: boolean; fullWidth?: boolean; hideMobileQuickNav?: boolean; hideMobileHeader?: boolean; mobileBottomBar?: boolean }) {
  const location = useLocation()
  const isMarketplaceApp = window.location.pathname === '/app' || window.location.pathname.startsWith('/app/')
  const isMarketingPage = window.location.pathname === '/' || ['/about', '/privacy', '/contact', '/help', '/faq', '/user-education', '/seller-education', '/return-policy', '/seller-privacy-policy', '/terms'].includes(window.location.pathname) || window.location.pathname === '/blog' || window.location.pathname.startsWith('/blog/')
  const homePath = isMarketplaceApp ? '/' : isMarketingPage ? '/' : '/app'
  const { user, logout, loading: authLoading } = useAuth()
  const { isAdmin } = useIsAdmin()
  const { isSeller, loading: sellerLoading } = useIsSeller()
  const [menuOpen, setMenuOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const [supportUnreadCount, setSupportUnreadCount] = useState(0)
  const [adminUnreadCount, setAdminUnreadCount] = useState(0)
  const [orderUnreadCount, setOrderUnreadCount] = useState(0)
  const sellerStatusLoading = authLoading || Boolean(user && sellerLoading)
  const mobileSellerAction: MobileQuickNavItem = user ? { to: '/sell', label: 'বিক্রি', icon: Plus, prominent: true } : { to: '/become-seller', label: 'বিক্রি', icon: Plus, prominent: true }
  const navLinks = (isAdmin ? [...NAV_LINKS, { to: '/admin', label: 'অ্যাডমিন', icon: UserRound }] : NAV_LINKS).map((item) => item.to === '/' ? { ...item, to: homePath } : item).filter((item) => !(item.to === '/become-seller' && sellerStatusLoading)).map((item) => item.to === '/become-seller' && isSeller ? { ...item, to: '/seller/dashboard', label: 'সেলার অ্যাকাউন্ট', icon: Store } : item)
  const mobileQuickLinks: MobileQuickNavItem[] = [
    { to: homePath, label: 'হোম', icon: Home },
    { to: '/chat', label: 'চ্যাট', icon: MessageCircle },
    mobileSellerAction,
    { to: '/orders', label: 'অর্ডার', icon: Package },
    { to: '/account', label: 'প্রোফাইল', icon: UserRound },
  ]
  const maxWidth = fullWidth ? 'max-w-none' : wide ? 'max-w-7xl' : 'max-w-3xl'
  const currentPageTitle = pageTitle(location.pathname)
  const closeMobileMenu = () => { setMenuOpen(false); setCityOpen(false) }
  const toggleMobileMenu = () => { setAccountOpen(false); setMenuOpen((open) => !open) }
  const toggleAccountMenu = () => { setMenuOpen(false); setAccountOpen((open) => !open) }
  const badgeForPath = (path: string) => path === '/chat' ? chatUnreadCount + supportUnreadCount : path === '/orders' ? orderUnreadCount : path === '/notifications' ? unreadCount : path === '/admin' ? adminUnreadCount : 0
  const displayName = user?.displayName?.trim() || 'BikriKoro সদস্য'

  useEffect(() => {
    if (!user) { setUnreadCount(0); return }
    let active = true
    void Promise.all([loadUnreadNotificationCount(user.uid), loadUnreadOrderNotificationCount(user.uid)]).then(([count, orderCount]) => { if (active) { setUnreadCount(count); setOrderUnreadCount(orderCount) } }).catch(() => undefined)
    const onChanged = (event: Event) => { const count = (event as CustomEvent<{ unreadCount?: number }>).detail?.unreadCount; if (typeof count === 'number') setUnreadCount(count) }
    const onOrderRead = () => { void loadUnreadOrderNotificationCount(user.uid).then((count) => { if (active) setOrderUnreadCount(count) }).catch(() => undefined) }
    const channel = supabase.channel(`header-notifications-${user.uid}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.uid}` }, () => setUnreadCount((count) => count + 1)).subscribe()
    window.addEventListener('bikrikoro-notifications-changed', onChanged)
    window.addEventListener('bikrikoro-order-read', onOrderRead)
    return () => { active = false; window.removeEventListener('bikrikoro-notifications-changed', onChanged); window.removeEventListener('bikrikoro-order-read', onOrderRead); void supabase.removeChannel(channel) }
  }, [user])

  useEffect(() => {
    if (!user || !isAdmin) { setAdminUnreadCount(0); return }
    let active = true
    const loadAdminUnread = async () => {
      const result = await adminRpc<number>('admin_count_support_unread')
      if (active && !result.error) setAdminUnreadCount(Number(result.data ?? 0))
    }
    void loadAdminUnread()
    const poller = window.setInterval(() => { void loadAdminUnread() }, 12000)
    const onRead = () => { void loadAdminUnread() }
    window.addEventListener('bikrikoro-admin-read', onRead)
    return () => { active = false; window.clearInterval(poller); window.removeEventListener('bikrikoro-admin-read', onRead) }
  }, [isAdmin, user])

  useEffect(() => {
    if (!fullScreen) return
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'; document.documentElement.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousBodyOverflow; document.documentElement.style.overflow = previousDocumentOverflow }
  }, [fullScreen])

  useEffect(() => {
    if (!user) { setChatUnreadCount(0); setSupportUnreadCount(0); return }
    let active = true
    const loadChatUnread = async () => {
      try {
        const [result, supportResult] = await Promise.all([
          chatRequest<{ threads?: Array<{ buyer_id: string; seller_id: string; buyer_unread_count: number; seller_unread_count: number }> }>({ action: 'list' }),
          chatRequest<{ unreadCount?: number }>({ action: 'support_unread_count' }),
        ])
        const total = (result.threads ?? []).reduce((sum, thread) => sum + Number(thread.buyer_id === user.uid ? thread.buyer_unread_count : thread.seller_unread_count), 0)
        if (active) { setChatUnreadCount(total); setSupportUnreadCount(Number(supportResult.unreadCount ?? 0)) }
      } catch { /* keep last known badge */ }
    }
    void loadChatUnread()
    const poller = window.setInterval(() => { void loadChatUnread() }, 12000)
    const channel = supabase.channel(`header-chat-${user.uid}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => { void loadChatUnread() }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_case_messages' }, () => { void loadChatUnread() }).subscribe()
    const onRead = () => { void loadChatUnread() }
    window.addEventListener('bikrikoro-chat-read', onRead)
    return () => { active = false; window.clearInterval(poller); window.removeEventListener('bikrikoro-chat-read', onRead); void supabase.removeChannel(channel) }
  }, [user])

  return (
    <div className={`site-minimal bg-bg text-ink-900 ${fullScreen ? 'flex h-[100dvh] min-h-0 flex-col overflow-hidden' : 'min-h-screen'}`}>
      <header className={`${hideMobileHeader ? 'hidden md:block' : ''} sticky top-0 z-40 border-b border-outline/45 bg-surface/95 shadow-[0_2px_12px_rgba(15,23,42,0.055)] backdrop-blur ${fullScreen ? 'shrink-0' : ''}`}>
        <div className={`mx-auto ${maxWidth} px-4 sm:px-5`}>
          <div className="flex min-h-[3.5rem] items-center gap-3 sm:min-h-[3.75rem] sm:gap-5">
            <Link to={homePath} className="flex shrink-0 items-center gap-2.5" onClick={closeMobileMenu}><img src="/icon-512.png" alt="BikriKoro" className="h-8 w-8 rounded-[0.85rem] shadow-sm ring-1 ring-brand-100 sm:h-9 sm:w-9" /><span className="hidden text-[15px] font-bold tracking-tight text-ink-900 sm:inline">BikriKoro<span className="text-brand-600">.Com</span></span></Link>
            <div className="hidden shrink-0 sm:block"><BackButton fallbackTo={backFallback} label={backLabel} /></div>
            <div className="min-w-0 flex-1 px-1 sm:px-2"><h1 className="truncate text-center text-[15px] font-bold text-ink-900 sm:text-lg">{currentPageTitle}</h1></div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <div className="relative hidden md:block"><button type="button" onClick={() => setCityOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-xl border border-outline bg-bg px-3 py-2 text-sm font-medium text-ink-700 hover:border-brand-300 hover:text-brand-700" aria-expanded={cityOpen}><MapPin size={16} className="text-brand-600" /><span>খুলনা</span><ChevronDown size={14} className={cityOpen ? 'rotate-180 transition' : 'transition'} /></button>{cityOpen && <div className="absolute right-0 top-12 z-50 w-44 rounded-2xl border border-outline bg-surface p-1.5 shadow-xl">{CITIES.map((city) => <Link key={city} to={`/products?location=${encodeURIComponent(city)}`} onClick={() => setCityOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-ink-700 hover:bg-brand-50 hover:text-brand-700"><MapPin size={14} />{city}</Link>)}</div>}</div>
              {user ? <div className="relative hidden md:block"><button type="button" onClick={toggleAccountMenu} className="inline-flex items-center gap-2 rounded-xl border border-outline px-3 py-2 text-sm font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700" aria-expanded={accountOpen} aria-haspopup="menu"><UserRound size={16} />অ্যাকাউন্ট<ChevronDown size={14} className={accountOpen ? 'rotate-180 transition' : 'transition'} /></button>{accountOpen && <div role="menu" className="absolute right-0 top-12 z-50 w-60 rounded-2xl border border-outline bg-surface p-1.5 shadow-xl">{ACCOUNT_LINKS.map((link) => <Link key={link.to} to={link.to} role="menuitem" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-700"><link.icon size={16} /><span className="min-w-0 flex-1">{link.label}</span>{badgeForPath(link.to) > 0 && <span className="min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[10px] font-bold leading-5 text-white">{badgeForPath(link.to) > 99 ? '99+' : badgeForPath(link.to)}</span>}</Link>)}<div className="my-1 h-px bg-outline" /><button type="button" onClick={() => { setAccountOpen(false); void logout() }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50" role="menuitem"><LogOut size={16} />লগআউট</button></div>}</div> : <Link to="/login" className="rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 sm:px-4">লগইন</Link>}
              <Link to="/notifications" className="relative rounded-full p-2 text-ink-700 hover:bg-brand-50 hover:text-brand-700 md:hidden" aria-label="নোটিফিকেশন"><Bell size={19} />{user && unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-bold leading-4 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}</Link>
              <button type="button" onClick={toggleMobileMenu} className="rounded-full border border-outline bg-bg p-2 text-ink-700 hover:border-brand-300 hover:text-brand-700 md:hidden" aria-label={menuOpen ? 'মেনু বন্ধ করুন' : 'মেনু খুলুন'} aria-expanded={menuOpen}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
            </div>
          </div>
          <nav className="hidden items-center justify-between border-t border-outline/70 py-2 md:flex"><div className="flex items-center gap-1">{navLinks.map((link) => <NavLink key={link.to} to={link.to} end={link.to === '/'} className={({ isActive }) => `group inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-bg hover:text-ink-900'}`}><link.icon size={15} strokeWidth={1.8} /><span>{link.label}</span></NavLink>)}</div><div className="flex items-center gap-1.5"><Link to="/settings" className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-ink-600 hover:bg-bg hover:text-brand-700"><Settings2 size={15} className="text-brand-600" />সেটিংস ও সহায়তা</Link><Link to="/notifications" className="relative rounded-xl p-2 text-ink-500 hover:bg-brand-50 hover:text-brand-700" aria-label="নোটিফিকেশন"><Bell size={17} />{user && unreadCount > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-bold leading-4 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}</Link></div></nav>
        </div>
      </header>
      {menuOpen && <MobileAccountDrawer user={user} displayName={displayName} isAdmin={isAdmin} links={DRAWER_LINKS} badgeForPath={badgeForPath} onClose={closeMobileMenu} onLogout={() => { closeMobileMenu(); void logout() }} />}
      <main className={fullScreen ? `mx-auto ${maxWidth} flex min-h-0 w-full flex-1 flex-col overflow-hidden px-4 py-4 sm:px-5 sm:py-5` : `mx-auto ${maxWidth} px-4 ${isMarketplaceApp || mobileBottomBar ? 'pb-[calc(7.5rem+env(safe-area-inset-bottom))]' : 'pb-8'} pt-5 sm:px-5 sm:pt-8 md:pb-8 md:py-8`}>{children}</main>
      {!hideFooter && !isMarketplaceApp && <footer className="border-t border-outline bg-surface pb-24 md:pb-0"><div className="mx-auto max-w-7xl px-4 py-8 sm:px-5 sm:py-10"><div className="grid gap-8 border-b border-outline pb-8 sm:grid-cols-2 lg:grid-cols-4"><div><Link to="/" className="text-lg font-extrabold text-ink-900">BikriKoro<span className="text-brand-600">.Com</span></Link><p className="mt-2 max-w-xs text-sm leading-6 text-ink-500">বাংলাদেশের নিরাপদ digital marketplace—গেম, সফটওয়্যার, সাবস্ক্রিপশন, কোর্স ও আরও অনেক কিছু কিনুন ও বিক্রি করুন।</p><Link to="/products" className="mt-3 inline-flex text-sm font-bold text-brand-700 hover:underline">সব পণ্য দেখুন</Link></div><div><h2 className="text-sm font-extrabold text-ink-900">জনপ্রিয় ক্যাটাগরি</h2><nav aria-label="জনপ্রিয় ক্যাটাগরি" className="mt-3 grid gap-2 text-sm text-ink-600"><Link to="/products?q=game" className="hover:text-brand-700">গেম ও গেমিং</Link><Link to="/products?q=software" className="hover:text-brand-700">সফটওয়্যার</Link><Link to="/products?q=subscription" className="hover:text-brand-700">সাবস্ক্রিপশন</Link><Link to="/products?q=course" className="hover:text-brand-700">কোর্স ও শিক্ষা</Link><Link to="/products?q=design" className="hover:text-brand-700">ডিজাইন ও টেমপ্লেট</Link></nav></div><div><h2 className="text-sm font-extrabold text-ink-900">BikriKoro সম্পর্কে</h2><nav aria-label="BikriKoro সম্পর্কে" className="mt-3 grid gap-2 text-sm text-ink-600"><Link to="/about" className="hover:text-brand-700">আমাদের সম্পর্কে</Link><Link to="/become-seller" className="hover:text-brand-700">সেলার হোন</Link><Link to="/seller-education" className="hover:text-brand-700">সেলার শিক্ষা</Link><Link to="/blog" className="hover:text-brand-700">গাইড ও ব্লগ</Link></nav></div><div><h2 className="text-sm font-extrabold text-ink-900">সাহায্য ও সাপোর্ট</h2><nav aria-label="সাহায্য ও সাপোর্ট" className="mt-3 grid gap-2 text-sm text-ink-600"><Link to="/help" className="hover:text-brand-700">Help Center</Link><Link to="/faq" className="hover:text-brand-700">সাধারণ প্রশ্ন (FAQ)</Link><Link to="/contact" className="hover:text-brand-700">যোগাযোগ করুন</Link><Link to="/return-policy" className="hover:text-brand-700">রিটার্ন পলিসি</Link><Link to="/privacy" className="hover:text-brand-700">প্রাইভেসি পলিসি</Link><Link to="/terms" className="hover:text-brand-700">শর্তাবলি</Link></nav></div></div><section className="mt-8 border border-outline bg-bg p-3 sm:p-4" aria-label="পেমেন্ট পদ্ধতি"><img src="/payment-logos/payment-options.png" alt="BikriKoro payment options" className="mx-auto h-auto w-full max-w-5xl object-contain" loading="lazy" /></section><div className="flex flex-col items-center gap-3 pt-6 text-sm text-ink-400 sm:flex-row sm:justify-between"><span>© {new Date().getFullYear()} Bikrikoro.Com</span><div className="flex flex-wrap justify-center gap-x-4 gap-y-2"><Link to="/settings" className="hover:text-ink-700">সেটিংস</Link><Link to="/help" className="hover:text-ink-700">সাহায্য</Link><Link to="/contact" className="hover:text-ink-700">সাপোর্ট</Link></div></div></div></footer>}
      {!fullScreen && !hideMobileQuickNav && !isMarketingPage && <nav aria-label="মোবাইল কুইক নেভিগেশন" className="fixed inset-x-0 bottom-0 z-50 rounded-t-[1.35rem] border border-white/70 bg-surface/95 shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur md:hidden"><div className="mx-auto grid max-w-xl grid-cols-5 items-end px-1 py-1.5">{mobileQuickLinks.map((link) => <NavLink key={link.label} to={link.to} end={link.to === '/' || link.to === '/app'} onClick={closeMobileMenu}>{({ isActive }) => <span className={`relative flex min-h-[3.4rem] min-w-0 flex-col items-center justify-end gap-1 px-1 pb-1 text-[10px] font-semibold ${isActive ? 'text-brand-700' : 'text-ink-600'}`}><span className={`flex items-center justify-center ${link.prominent ? `-mt-7 h-14 w-14 rounded-full border-4 border-bg text-white shadow-[0_8px_20px_rgba(23,157,114,0.32)] ${isActive ? 'bg-brand-700' : 'bg-brand-500'}` : isActive ? 'h-8 w-12 rounded-full bg-brand-100 text-brand-700' : 'h-8 w-12 text-ink-600'}`}><link.icon size={link.prominent ? 25 : 20} strokeWidth={isActive ? 2.3 : 1.8} /></span><span className={`max-w-full truncate leading-4 ${isActive ? 'font-bold' : ''}`}>{link.label}</span>{badgeForPath(link.to) > 0 && <span className="absolute right-1/4 top-0 min-w-4 rounded-full bg-red-500 px-1 text-center text-[9px] font-bold leading-4 text-white">{badgeForPath(link.to) > 99 ? '99+' : badgeForPath(link.to)}</span>}</span>}</NavLink>)}</div></nav>}
    </div>
  )
}

function MobileAccountDrawer({ user, displayName, isAdmin, links, badgeForPath, onClose, onLogout }: { user: { photoURL?: string | null } | null; displayName: string; isAdmin: boolean; links: NavItem[]; badgeForPath: (path: string) => number; onClose: () => void; onLogout: () => void }) {
  return <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="অ্যাকাউন্ট মেনু"><button type="button" className="absolute inset-0 bg-ink-900/45 backdrop-blur-[1px]" onClick={onClose} aria-label="মেনু বন্ধ করুন" /><aside className="relative ml-auto flex h-full w-[min(86vw,22rem)] animate-drawer-in flex-col overflow-y-auto rounded-l-[2rem] border-l border-white/80 bg-bg shadow-2xl"><div className="relative border-b border-outline bg-surface px-5 pb-5 pt-8"><button type="button" onClick={onClose} aria-label="মেনু বন্ধ করুন" className="absolute right-4 top-4 rounded-full border border-outline bg-bg p-2 text-ink-500 shadow-sm transition hover:bg-brand-50 hover:text-brand-700"><X size={18} /></button><div className="flex items-center gap-3 pr-8"><div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-100 text-2xl font-bold text-brand-700">{user?.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" /> : displayName.charAt(0)}</div><div className="min-w-0"><p className="truncate text-lg font-bold text-ink-900">{displayName}</p><span className="mt-1 inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700"><ShieldCheck size={14} />{user ? 'প্রোফাইল যাচাই করুন' : 'BikriKoro-তে স্বাগতম'}</span></div></div></div><div className="flex-1 px-3 py-4">{links.map((link) => <Link key={link.to} to={link.to} onClick={onClose} className="group flex items-center gap-4 rounded-2xl px-4 py-3.5 text-[15px] font-semibold text-ink-700 transition hover:bg-surface hover:text-brand-700"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600 shadow-sm transition group-hover:border-brand-200 group-hover:bg-brand-100"><link.icon size={19} strokeWidth={2.1} /></span><span className="min-w-0 flex-1">{link.label}</span>{badgeForPath(link.to) > 0 && <span className="min-w-5 rounded-full bg-red-500 px-1.5 text-center text-[10px] font-bold leading-5 text-white">{badgeForPath(link.to)}</span>}</Link>)}{isAdmin && <Link to="/admin" onClick={onClose} className="group flex items-center gap-4 rounded-2xl bg-brand-50 px-4 py-3.5 text-[15px] font-extrabold text-brand-800 transition hover:bg-brand-100"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-200 bg-white text-brand-700 shadow-sm"><ShieldCheck size={19} strokeWidth={2.1} /></span><span className="min-w-0 flex-1">অ্যাডমিন প্যানেল</span></Link>}<div className="my-3 h-px bg-outline" /><Link to="/account" onClick={onClose} className="group flex items-center gap-4 rounded-2xl px-4 py-3.5 text-[15px] font-semibold text-ink-700 transition hover:bg-surface hover:text-brand-700"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand-100 bg-brand-50 text-brand-600 shadow-sm"><UserRound size={19} strokeWidth={2.1} /></span><span>অ্যাকাউন্ট দেখুন</span></Link></div><div className="border-t border-outline p-4">{user ? <button type="button" onClick={onLogout} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600"><LogOut size={17} />লগআউট</button> : <Link to="/login" onClick={onClose} className="flex w-full items-center justify-center rounded-2xl bg-brand-500 px-4 py-3 text-sm font-bold text-white">লগইন করে শুরু করুন</Link>}</div></aside></div>
}
