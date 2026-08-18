import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, BellRing, CheckCircle2, Search, ShieldCheck, ShoppingBag, Sparkles, Store } from 'lucide-react'
import { WELCOME_SPLASH_REPLAY_EVENT, WELCOME_SPLASH_STORAGE_KEY } from '@/lib/welcomeSplash'

const highlights = [
  { label: 'সহজে খুঁজুন', icon: Search },
  { label: 'নিরাপদ লেনদেন', icon: ShieldCheck },
  { label: 'বিশ্বাসযোগ্য seller', icon: Store },
  { label: 'সব update সময়মতো', icon: BellRing },
]

export function FirstVisitSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(WELCOME_SPLASH_STORAGE_KEY) !== '1')
    } catch {
      setVisible(true)
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(media.matches)
    updateMotion()
    media.addEventListener?.('change', updateMotion)

    const replay = () => {
      setClosing(false)
      setVisible(true)
    }
    window.addEventListener(WELCOME_SPLASH_REPLAY_EVENT, replay)

    return () => {
      media.removeEventListener?.('change', updateMotion)
      window.removeEventListener(WELCOME_SPLASH_REPLAY_EVENT, replay)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === 'ArrowRight') finish()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const finish = () => {
    try { window.localStorage.setItem(WELCOME_SPLASH_STORAGE_KEY, '1') } catch { /* private browsing may block storage */ }
    setClosing(true)
    window.setTimeout(() => setVisible(false), reducedMotion ? 0 : 220)
  }

  return (
    <>
      {children}
      {visible && (
        <div className={`fixed inset-0 z-[100] h-[100dvh] w-full overflow-hidden bg-white text-ink-900 transition-opacity duration-300 ${closing ? 'pointer-events-none opacity-0' : 'opacity-100'}`} role="dialog" aria-modal="true" aria-label="BikriKoro স্বাগত স্ক্রিন">
          <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-brand-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-brand-50 blur-3xl" />
          <div className="relative mx-auto flex h-full w-full max-w-6xl flex-col px-4 pb-3 pt-4 sm:px-6 sm:pb-5 sm:pt-5 lg:px-10">
            <header className="flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-white p-1.5 shadow-sm sm:h-11 sm:w-11"><img src="/icon-512.png" alt="" className="h-full w-full rounded-lg" /></div>
                <div className="min-w-0"><p className="truncate text-sm font-bold tracking-tight text-brand-700 sm:text-base">BikriKoro.Com</p><p className="truncate text-[10px] text-ink-500 sm:text-xs">বাংলাদেশের নিজের digital marketplace</p></div>
              </div>
              <button type="button" onClick={finish} className="shrink-0 rounded-full border border-brand-200 bg-white px-3.5 py-2 text-xs font-semibold text-brand-700 shadow-sm transition hover:border-brand-400 hover:bg-brand-50">এড়িয়ে যান</button>
            </header>

            <main className="flex min-h-0 flex-1 flex-col justify-center gap-3 py-3 sm:gap-5 sm:py-5 lg:grid lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-12 lg:py-6">
              <section className={`min-h-0 shrink-0 ${reducedMotion ? '' : 'animate-[splash-copy-in_420ms_ease-out]'}`}>
                <div className="flex items-center gap-2 text-xs font-bold text-brand-700 sm:text-sm"><ShoppingBag size={17} />BikriKoro.Com-এ স্বাগতম</div>
                <h1 className="mt-2 max-w-2xl text-[clamp(1.75rem,7vw,3.8rem)] font-bold leading-[1.08] tracking-tight text-ink-900">কেনাকাটা হোক সহজ,<br /><span className="text-brand-600">বিক্রি হোক নিশ্চিন্তে</span></h1>
                <p className="mt-3 max-w-xl text-xs leading-5 text-ink-600 sm:mt-4 sm:text-sm sm:leading-6 lg:text-base">ভালো পণ্য খুঁজুন, বিশ্বাসযোগ্য seller বেছে নিন এবং নিরাপদে order করুন—সবকিছু এক জায়গায়।</p>
                <div className="mt-3 grid max-w-xl grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
                  {highlights.map(({ label, icon: Icon }) => <div key={label} className="flex min-w-0 items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-2.5 py-2 text-[11px] font-semibold text-brand-700 sm:rounded-2xl sm:px-3 sm:py-2.5 sm:text-xs"><Icon size={15} className="shrink-0 text-brand-600" /> <span className="truncate">{label}</span></div>)}
                </div>
              </section>

              <section className={`flex min-h-0 max-h-[34vh] min-h-[12rem] items-center justify-center lg:max-h-none lg:min-h-[22rem] ${reducedMotion ? '' : 'animate-[splash-card-in_520ms_ease-out]'}`} aria-label="BikriKoro-এর সুবিধা">
                <div className="relative w-full max-w-md rounded-[2rem] border border-brand-100 bg-brand-50/70 p-3 shadow-[0_18px_50px_rgba(1,124,80,0.12)] sm:p-5">
                  <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm sm:p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><ShoppingBag size={19} /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold text-ink-500 sm:text-xs">আজকের marketplace</p><p className="truncate text-sm font-bold text-ink-900 sm:text-base">পছন্দের পণ্য খুঁজুন</p></div><Sparkles size={18} className="shrink-0 text-brand-500" /></div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-3"><div className="rounded-2xl border border-brand-100 bg-white p-3 sm:p-4"><CreditBadge /><p className="mt-2 text-[10px] text-ink-500 sm:text-xs">Digital</p><p className="text-xs font-bold text-brand-700 sm:text-sm">সহজ delivery</p></div><div className="rounded-2xl border border-brand-100 bg-white p-3 sm:p-4"><Store size={20} className="text-brand-600" /><p className="mt-2 text-[10px] text-ink-500 sm:text-xs">Physical</p><p className="text-xs font-bold text-brand-700 sm:text-sm">নিরাপদ order</p></div></div>
                  <div className="mt-2 flex items-center gap-2 rounded-2xl bg-brand-600 px-3 py-2.5 text-white sm:mt-3 sm:px-4 sm:py-3"><CheckCircle2 size={18} className="shrink-0 text-brand-100" /><p className="text-xs font-semibold sm:text-sm">এক জায়গায় পণ্য, seller এবং নিরাপদ লেনদেন</p></div>
                </div>
              </section>
            </main>

            <footer className="flex shrink-0 flex-col gap-3 border-t border-brand-100 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-4">
              <div className="flex items-center gap-2 text-xs text-ink-500"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" /><span>আপনার নিরাপদ marketplace journey শুরু হোক আজ</span></div>
              <button type="button" onClick={finish} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 sm:w-auto sm:min-w-40">চালিয়ে যান <ArrowRight size={17} /></button>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}

function CreditBadge() {
  return <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-50 text-brand-700"><span className="h-2.5 w-3.5 rounded-sm border-2 border-current" /></span>
}
