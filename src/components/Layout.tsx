import { type ReactNode, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { SearchBar } from '@/components/SearchBar'

const NAV_LINKS = [
  { to: '/', label: 'হোম' },
  { to: '/products', label: 'প্রোডাক্ট' },
  { to: '/compare', label: 'তুলনা' },
  { to: '/sell', label: 'বিক্রি করুন' },
  { to: '/become-seller', label: 'বিক্রেতা হোন' },
  { to: '/my-listings', label: 'আমার লিস্টিং' },
  { to: '/orders', label: 'অর্ডার' },
  { to: '/library', label: 'ডিজিটাল লাইব্রেরি' },
  { to: '/notifications', label: 'নোটিফিকেশন' },
  { to: '/chat', label: 'চ্যাট' },
  { to: '/wallet', label: 'ওয়ালেট' },
  { to: '/account', label: 'অ্যাকাউন্ট' },
]

export function Layout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { user, logout } = useAuth()
  const { isAdmin } = useIsAdmin()
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = isAdmin ? [...NAV_LINKS, { to: '/admin', label: 'অ্যাডমিন' }] : NAV_LINKS

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-outline bg-surface/95 backdrop-blur">
        <div className={`mx-auto flex items-center gap-4 px-5 py-3.5 ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <img src="/icon-192.png" alt="BikriKoro" className="h-8 w-8 rounded-lg" />
            <span className="hidden font-semibold text-ink-900 sm:inline">
              Bikrikoro<span className="text-brand-600">.Com</span>
            </span>
          </Link>

          <div className="hidden flex-1 sm:block">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {user && (
              <Link to="/favorites" className="text-lg text-ink-600 hover:text-error" aria-label="পছন্দের তালিকা">
                ♡
              </Link>
            )}
            {user ? (
              <button
                onClick={() => logout()}
                className="hidden text-sm font-medium text-ink-600 hover:text-error sm:inline"
              >
                লগআউট
              </button>
            ) : (
              <Link
                to="/login"
                className="rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-600"
              >
                লগইন
              </Link>
            )}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="text-ink-600 md:hidden"
              aria-label="মেনু"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        <nav className="hidden items-center gap-6 border-t border-outline px-5 py-2.5 md:flex">
          <div className={`mx-auto flex w-full items-center gap-6 ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `text-sm font-medium transition ${
                    isActive ? 'text-brand-600' : 'text-ink-600 hover:text-ink-900'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="border-t border-outline px-5 py-2.5 sm:hidden">
          <SearchBar compact />
        </div>

        {menuOpen && (
          <nav className="border-t border-outline bg-surface px-5 py-3 md:hidden">
            <div className="flex flex-col gap-3">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `text-sm font-medium ${isActive ? 'text-brand-600' : 'text-ink-600'}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              {user && (
                <NavLink
                  to="/favorites"
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium text-ink-600"
                >
                  পছন্দের তালিকা
                </NavLink>
              )}
              {user && (
                <button
                  onClick={() => logout()}
                  className="text-left text-sm font-medium text-error"
                >
                  লগআউট
                </button>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className={`mx-auto px-5 py-8 ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>{children}</main>

      <footer className="border-t border-outline">
        <div className={`mx-auto flex flex-col items-center gap-3 px-5 py-6 text-xs text-ink-300 sm:flex-row sm:justify-between ${wide ? 'max-w-6xl' : 'max-w-2xl'}`}>
          <span>© {new Date().getFullYear()} Bikrikoro.Com</span>
          <div className="flex gap-4">
            <Link to="/about" className="hover:text-ink-600">
              আমাদের সম্পর্কে
            </Link>
            <Link to="/contact" className="hover:text-ink-600">
              যোগাযোগ
            </Link>
            <Link to="/privacy" className="hover:text-ink-600">
              প্রাইভেসি পলিসি
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
