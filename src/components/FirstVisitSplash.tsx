import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, BellRing, CheckCircle2, ShieldCheck, ShoppingBag, X } from 'lucide-react'
import { WELCOME_SPLASH_REPLAY_EVENT, WELCOME_SPLASH_STORAGE_KEY } from '@/lib/welcomeSplash'

const scenes = [
  {
    eyebrow: 'BikriKoro.Com-এ স্বাগতম',
    title: 'বিশ্বাস করে কিনুন, নিশ্চিন্তে বিক্রি করুন',
    description: 'বাংলাদেশের জন্য তৈরি নিরাপদ online marketplace—পণ্য খুঁজুন, তুলনা করুন এবং সহজে order করুন।',
    icon: ShoppingBag,
  },
  {
    eyebrow: 'নিরাপদ লেনদেন',
    title: 'Escrow সুরক্ষায় আপনার টাকা',
    description: 'পণ্য হাতে পাওয়ার আগে seller-এর কাছে টাকা যায় না। Order, dispute এবং support—সবকিছু এক জায়গায়।',
    icon: ShieldCheck,
  },
  {
    eyebrow: 'সব update সময়মতো',
    title: 'Notification চালু রাখুন',
    description: 'Order, payment, chat, verification ও wallet update-এর খবর পেতে notification চালু করতে পারবেন।',
    icon: BellRing,
  },
]

export function FirstVisitSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(0)
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
      setSceneIndex(0)
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
    if (!visible || closing || reducedMotion) return
    const timer = window.setInterval(() => setSceneIndex((index) => (index + 1) % scenes.length), 1800)
    return () => window.clearInterval(timer)
  }, [closing, reducedMotion, visible])

  const finish = () => {
    try { window.localStorage.setItem(WELCOME_SPLASH_STORAGE_KEY, '1') } catch { /* private browsing may block storage */ }
    setClosing(true)
    window.setTimeout(() => setVisible(false), reducedMotion ? 0 : 220)
  }

  const scene = scenes[sceneIndex]
  const SceneIcon = scene.icon

  return (
    <>
      {children}
      {visible && (
        <div className={`fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 p-4 text-white transition-opacity duration-200 sm:p-6 ${closing ? 'pointer-events-none opacity-0' : 'opacity-100'}`} role="dialog" aria-modal="true" aria-label="BikriKoro স্বাগত বার্তা">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl" />
          <div className={`relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/15 bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-6 shadow-2xl shadow-black/30 sm:p-8 ${reducedMotion ? '' : 'animate-[splash-card-in_420ms_ease-out]'}`}>
            <div className="absolute right-5 top-5 flex items-center gap-2">
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-brand-50">প্রথমবারের স্বাগত</span>
              <button type="button" onClick={finish} className="rounded-lg p-1 text-white/60 transition hover:bg-white/10 hover:text-white" aria-label="স্প্ল্যাশ বন্ধ করুন"><X size={18} /></button>
            </div>
            <div className="flex min-h-[25rem] flex-col justify-between pt-10">
              <div>
                <div className={`flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-white shadow-lg shadow-brand-900/20 ${reducedMotion ? '' : 'animate-[splash-logo-in_700ms_ease-out]'}`}><img src="/icon-512.png" alt="BikriKoro.Com" className="h-16 w-16 rounded-2xl" /></div>
                <div className={`mt-8 transition-opacity duration-300 ${reducedMotion ? '' : 'animate-[splash-copy-in_400ms_ease-out]'}`} key={sceneIndex}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-brand-100"><SceneIcon size={16} />{scene.eyebrow}</div>
                  <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-[2.1rem]">{scene.title}</h1>
                  <p className="mt-4 text-sm leading-7 text-brand-50/90">{scene.description}</p>
                </div>
                <div className="mt-6 flex items-center gap-2" aria-label={`স্বাগত বার্তা ${sceneIndex + 1} of ${scenes.length}`}>
                  {scenes.map((_, index) => <span key={index} className={`h-1.5 rounded-full transition-all duration-300 ${index === sceneIndex ? 'w-8 bg-white' : 'w-2 bg-white/35'}`} />)}
                </div>
              </div>
              <div className="mt-8">
                <div className="mb-4 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-3 text-xs leading-5 text-brand-50"><CheckCircle2 size={16} className="shrink-0 text-brand-100" />নিরাপদ কেনাকাটা, trusted seller এবং responsive support—সব একসাথে।</div>
                <button type="button" onClick={finish} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-bold text-brand-700 shadow-lg shadow-brand-900/15 transition hover:bg-brand-50">শুরু করি <ArrowRight size={17} /></button>
                <p className="mt-3 text-center text-[11px] text-brand-100/80">পরে Settings ও Help থেকে এই পরিচিতি আবার দেখা যাবে।</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

