import { ArrowLeft } from 'lucide-react'
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
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-outline bg-surface p-2.5 text-ink-700 shadow-sm transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
      aria-label={label}
    >
      <ArrowLeft size={19} strokeWidth={2} />
    </button>
  )
}
