import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { WELCOME_SPLASH_REPLAY_EVENT, WELCOME_SPLASH_STORAGE_KEY } from '@/lib/welcomeSplash'

const scenes = [
  {
    id: 'discover',
    image: '/onboarding/digital-products.png',
    title: 'ডিজিটাল প্রোডাক্ট\nসহজে কিনুন',
    description: 'আপনার প্রয়োজনীয় ডিজিটাল প্রোডাক্ট খুঁজুন, অর্ডার করুন এবং সহজেই সংগ্রহ করুন।',
  },
  {
    id: 'secure',
    image: '/onboarding/secure-shopping.png',
    title: 'নিরাপদে\nকেনাকাটা করুন',
    description: 'টাকা সরাসরি বিক্রেতার কাছে চলে যায় না। আপনার অর্ডার সুরক্ষিত রাখার জন্য BikriKoro-র secure payment ও order protection ব্যবস্থা রয়েছে।',
  },
  {
    id: 'sell',
    image: '/onboarding/seller-income.png',
    title: 'বিক্রি করুন,\nআয় করুন',
    description: 'আপনার তৈরি বা মালিকানাধীন ডিজিটাল প্রোডাক্ট BikriKoro-তে বিক্রি করুন এবং নতুন কাস্টমারের কাছে পৌঁছান।',
  },
] as const

export function FirstVisitSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [failedImages, setFailedImages] = useState<string[]>([])

  useEffect(() => {
    try { setVisible(window.localStorage.getItem(WELCOME_SPLASH_STORAGE_KEY) !== '1') } catch { setVisible(true) }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(media.matches)
    updateMotion()
    media.addEventListener?.('change', updateMotion)
    const replay = () => { setSceneIndex(0); setClosing(false); setVisible(true) }
    window.addEventListener(WELCOME_SPLASH_REPLAY_EVENT, replay)
    return () => {
      media.removeEventListener?.('change', updateMotion)
      window.removeEventListener(WELCOME_SPLASH_REPLAY_EVENT, replay)
    }
  }, [])

  useEffect(() => {
    scenes.forEach((item) => {
      const image = new Image()
      image.src = item.image
      image.onerror = () => setFailedImages((current) => current.includes(item.image) ? current : [...current, item.image])
    })
  }, [])

  const finish = () => {
    try { window.localStorage.setItem(WELCOME_SPLASH_STORAGE_KEY, '1') } catch { /* ignore storage errors */ }
    setClosing(true)
    window.setTimeout(() => setVisible(false), reducedMotion ? 0 : 220)
  }

  const goNext = () => {
    if (sceneIndex === scenes.length - 1) finish()
    else setSceneIndex((index) => index + 1)
  }

  const goPrevious = () => setSceneIndex((index) => Math.max(0, index - 1))

  useEffect(() => {
    if (!visible) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
      if (event.key === 'Enter' || event.key === 'ArrowRight') goNext()
      if (event.key === 'ArrowLeft') goPrevious()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const scene = scenes[sceneIndex]

  return <>
    {children}
    {visible && <div className={`fixed inset-0 z-[100] flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#edf8f2] text-ink-900 transition-opacity duration-300 ${closing ? 'pointer-events-none opacity-0' : 'opacity-100'}`} role="dialog" aria-modal="true" aria-label="BikriKoro onboarding">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(212,245,230,0.95),transparent_42%)]" />
      <div className="relative flex h-full w-full max-w-md flex-col bg-[#fbfefc] px-6 pb-7 pt-6 shadow-2xl shadow-brand-900/10 sm:h-[min(900px,calc(100dvh-32px))] sm:rounded-[2rem] sm:px-8 sm:pt-8">
        <header className="flex items-center justify-center">
          <div className="flex items-center gap-3">
            <img src="/icon-512.png" alt="" className="h-14 w-14 rounded-[1.15rem] object-cover shadow-sm" />
            <span className="text-[1.9rem] font-black tracking-[-0.06em] text-brand-700">BikriKoro</span>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col justify-center pt-4">
          <section key={scene.id} className={`flex min-h-0 flex-col items-center ${reducedMotion ? '' : 'animate-[splash-copy-in_240ms_ease-out]'}`}>
            <div className="relative flex min-h-[17rem] w-full items-center justify-center overflow-hidden rounded-[2rem] bg-[#effbf5] px-1 shadow-[0_18px_50px_rgba(1,124,80,0.08)] sm:min-h-0">
              {failedImages.includes(scene.image) ? <div className="flex h-full min-h-[17rem] w-full flex-col items-center justify-center gap-3 px-8 text-center"><img src="/icon-192.png" alt="" className="h-16 w-16 rounded-2xl shadow-sm" /><p className="text-sm font-semibold text-brand-700">BikriKoro-তে স্বাগতম</p><p className="text-xs leading-5 text-ink-500">এই দৃশ্যের ছবি এখন লোড করা যাচ্ছে না, তবে আপনি পরের ধাপে যেতে পারবেন।</p></div> : <img src={scene.image} alt="" fetchPriority="high" className="h-auto w-full object-contain" draggable="false" onError={() => setFailedImages((current) => current.includes(scene.image) ? current : [...current, scene.image])} />}
            </div>
            <div className="mt-6 text-center">
              <h1 className="whitespace-pre-line text-[clamp(2rem,9vw,2.9rem)] font-black leading-[1.08] tracking-[-0.055em] text-ink-900">{scene.title}</h1>
              <p className="mx-auto mt-4 max-w-[22rem] text-[0.95rem] leading-7 text-ink-600">{scene.description}</p>
            </div>
          </section>
        </main>

        <footer className="mt-5">
          <div className="flex items-center justify-center gap-2" aria-label={`ধাপ ${sceneIndex + 1} / ${scenes.length}`}>
            {scenes.map((item, index) => <button key={item.id} type="button" onClick={() => setSceneIndex(index)} aria-label={`ধাপ ${index + 1}`} className={`h-2.5 rounded-full transition-all ${index === sceneIndex ? 'w-2.5 bg-brand-600' : 'w-2.5 bg-ink-200 hover:bg-brand-300'}`} />)}
          </div>
          <div className="mt-6 flex items-center justify-between gap-4">
            <button type="button" onClick={finish} className="rounded-xl px-1 py-3 text-base font-semibold text-ink-600 transition hover:text-brand-700">Skip</button>
            <div className="flex items-center gap-2">
              {sceneIndex > 0 && <button type="button" onClick={goPrevious} aria-label="আগের ধাপ" className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-brand-200 text-brand-700 transition hover:bg-brand-50"><ArrowLeft size={19} /></button>}
              <button type="button" onClick={goNext} className="inline-flex min-w-[8.8rem] items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">{sceneIndex === scenes.length - 1 ? 'Get Started' : 'Next'}<ArrowRight size={18} /></button>
            </div>
          </div>
        </footer>
      </div>
    </div>}
  </>
}
