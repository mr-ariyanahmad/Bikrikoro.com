import { useState, type ReactNode } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'

const groups = [
  {
    label: 'ওভারভিউ',
    links: [{ to: '/admin', label: 'ড্যাশবোর্ড', icon: '▦' }],
  },
  {
    label: 'সেলস',
    links: [
      { to: '/admin/orders', label: 'অর্ডার', icon: '▣' },
      { to: '/admin/deliveries', label: 'ডেলিভারি', icon: '▱' },
      { to: '/admin/customers', label: 'কাস্টমার', icon: '♙' },
      { to: '/admin/coupons', label: 'কুপন', icon: '◇' },
      { to: '/admin/reviews', label: 'রিভিউ', icon: '☆' },
      { to: '/admin/disputes', label: 'ডিসপিউট', icon: '!' },
    ],
  },
  {
    label: 'ক্যাটালগ',
    links: [
      { to: '/admin/products', label: 'প্রোডাক্ট', icon: '□' },
      { to: '/admin/categories', label: 'ক্যাটাগরি', icon: '⌑' },
      { to: '/admin/industries', label: 'ইন্ডাস্ট্রি', icon: '⌂' },
    ],
  },
  {
    label: 'কনটেন্ট',
    links: [
      { to: '/admin/gallery', label: 'গ্যালারি', icon: '▧' },
      { to: '/admin/downloads', label: 'ডাউনলোড', icon: '⇩' },
      { to: '/admin/blog', label: 'নিউজ ও ব্লগ', icon: '▤' },
      { to: '/admin/sellers', label: 'সেলার ভেরিফিকেশন', icon: '✓' },
    ],
  },
  {
    label: 'সিস্টেম',
    links: [
      { to: '/admin/invoice-settings', label: 'ইনভয়েস সেটিংস', icon: '▤' },
      { to: '/admin/site-settings', label: 'সাইট সেটিংস', icon: '⚙' },
      { to: '/admin/system-status', label: 'সিস্টেম স্ট্যাটাস', icon: '▣' },
    ],
  },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const { isAdmin } = useIsAdmin()
  const [open, setOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-ink-900">
      <div className="flex min-h-screen">
        {open && <button aria-label="মেনু বন্ধ করুন" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-ink-900/50 md:hidden" />}
        <aside className={`fixed inset-y-0 left-0 z-50 flex w-[278px] flex-col bg-[#0c2137] text-white shadow-2xl transition-transform duration-200 md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
            <Link to="/admin" onClick={() => setOpen(false)} className="text-xl font-semibold tracking-tight">
              BikriKoro <span className="text-brand-300">Admin</span>
            </Link>
            <button onClick={() => setOpen(false)} className="text-2xl text-white/60 hover:text-white md:hidden" aria-label="মেনু বন্ধ করুন">×</button>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 py-5">
            {groups.map((group) => (
              <div key={group.label} className="mb-6">
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">{group.label}</p>
                <div className="space-y-1">
                  {group.links.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.to === '/admin'}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-[#0e6bdc] text-white shadow-lg shadow-blue-950/30' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-current/30 text-base">{link.icon}</span>
                      <span>{link.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="border-t border-white/10 p-4">
            <div className="mb-3 truncate rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">{isAdmin ? user?.email ?? 'অ্যাডমিন' : 'অ্যাক্সেস যাচাই হচ্ছে...'}</div>
            <button onClick={() => logout()} className="w-full rounded-xl border border-white/15 px-3 py-2 text-left text-sm text-white/75 hover:bg-white/10 hover:text-white">লগআউট</button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/90 px-4 shadow-sm backdrop-blur md:px-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setOpen(true)} className="rounded-xl border border-slate-200 px-3 py-2 text-xl text-ink-700 md:hidden" aria-label="অ্যাডমিন মেনু খুলুন">☰</button>
              <div>
                <p className="text-xs font-medium text-slate-400">BikriKoro.Com</p>
                <p className="text-sm font-semibold text-slate-800">অ্যাডমিন ওয়ার্কস্পেস</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-brand-500 hover:text-brand-600">সাইট দেখুন</Link>
              <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 sm:flex">{(user?.displayName || user?.email || 'A').charAt(0).toUpperCase()}</span>
            </div>
          </header>
          <main className="w-full flex-1 p-4 sm:p-6 md:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
      <div aria-hidden="true" className="hidden">{location.pathname}</div>
    </div>
  )
}

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function AdminStatCard({ label, value, helper, tone = 'green' }: { label: string; value: string | number; helper?: string; tone?: 'green' | 'blue' | 'amber' | 'red' }) {
  const tones = { green: 'text-brand-700 bg-brand-50', blue: 'text-blue-700 bg-blue-50', amber: 'text-amber-700 bg-amber-50', red: 'text-red-700 bg-red-50' }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      {helper && <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{helper}</span>}
    </div>
  )
}

export function AdminTableCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
}
