import { ArrowLeft, Home } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

export function BackButton({ fallbackTo = '/', label = 'ফিরে যান' }: { fallbackTo?: string; label?: string }) {
  const navigate = useNavigate()
  const location = useLocation()

  if (location.pathname === fallbackTo) return null

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate(fallbackTo)
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="inline-flex shrink-0 items-center gap-2 border border-outline bg-surface px-3 py-2 text-base font-semibold text-ink-700 shadow-sm transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
      aria-label={label}
    >
      <ArrowLeft size={16} />
      <span>{label}</span>
      {location.pathname === '/login' || location.pathname === '/become-seller' ? <Home size={14} className="text-ink-300" /> : null}
    </button>
  )
}
