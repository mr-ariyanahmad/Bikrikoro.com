import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BadgeCheck, BellRing, Search, ShieldCheck, ShoppingBag, Store, WalletCards } from 'lucide-react'
import { WELCOME_SPLASH_REPLAY_EVENT, WELCOME_SPLASH_STORAGE_KEY } from '@/lib/welcomeSplash'

const scenes = [
  {
    id: 'discover',
    step: '01',
    eyebrow: 'খুঁজে নিন সহজে',
    title: 'আপনার দরকারি ডিজিটাল পণ্য, এক জায়গায়।',
    description: 'বিভাগ, দাম ও বিক্রেতা দেখে দ্রুত পছন্দ করুন—অপ্রয়োজনীয় ঝামেলা ছাড়াই।',
    icon: Search,
    bullets: ['স্মার্ট সার্চ ও ক্যাটাগরি', 'দাম ও বিক্রেতা তুলনা', 'পছন্দের পণ্য সেভ করে রাখুন'],
  },
  {
    id: 'secure',
    step: '02',
    eyebrow: 'নিরাপদে পেমেন্ট করুন',
    title: 'পেমেন্ট থেকে ডেলিভারি—সবকিছু পরিষ্কার।',
    description: 'অর্ডারের প্রতিটি ধাপ দেখুন। সমস্যা হলে সহায়তা ও অভিযোগের পথও হাতের কাছে।',
    icon: ShieldCheck,
    bullets: ['bKash ও অনলাইন পেমেন্ট', 'অর্ডার স্ট্যাটাস ট্র্যাক করুন', 'সুরক্ষিত escrow workflow'],
  },
  {
    id: 'sell',
    step: '03',
    eyebrow: 'আপনিও বিক্রি শুরু করুন',
    title: 'আপনার ডিজিটাল পণ্য, আপনার ব্যবসা।',
    description: 'একটি সুন্দর listing তৈরি করুন, ক্রেতার সাথে কথা বলুন এবং বিক্রির পুরো যাত্রা সামলান।',
    icon: Store,
    bullets: ['নিজের shop profile তৈরি', 'যাচাই ও rating-এ আস্থা', 'বিক্রি, delivery ও wallet একসাথে'],
  },
] as const

type SceneId = (typeof scenes)[number]['id']

export function FirstVisitSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [sceneIndex, setSceneIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    try { setVisible(window.localStorage.getItem(WELCOME_SPLASH_STORAGE_KEY) !== '1') } catch { setVisible(true) }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotion = () => setReducedMotion(media.matches)
    updateMotion()
    media.addEventListener?.('change', updateMotion)
    const replay = () => { setSceneIndex(0); setClosing(false); setVisible(true) }
    window.addEventListener(WELCOME_SPLASH_REPLAY_EVENT, replay)
    return () => { media.removeEventListener?.('change', updateMotion); window.removeEventListener(WELCOME_SPLASH_REPLAY_EVENT, replay) }
  }, [])

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

  const finish = () => {
    try { window.localStorage.setItem(WELCOME_SPLASH_STORAGE_KEY, '1') } catch { /* ignore storage errors */ }
    setClosing(true)
    window.setTimeout(() => setVisible(false), reducedMotion ? 0 : 220)
  }
  const goNext = () => sceneIndex === scenes.length - 1 ? finish() : setSceneIndex((index) => index + 1)
  const goPrevious = () => setSceneIndex((index) => Math.max(0, index - 1))
  const scene = scenes[sceneIndex]
  const SceneIcon = scene.icon

  return <>
    {children}
    {visible && <div className={`fixed inset-0 z-[100] h-[100dvh] w-full overflow-y-auto bg-[#f6fbf8] text-ink-900 transition-opacity duration-300 ${closing ? 'pointer-events-none opacity-0' : 'opacity-100'}`} role="dialog" aria-modal="true" aria-label="BikriKoro onboarding">
      <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-brand-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-emerald-100/60 blur-3xl" />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 p-1.5 shadow-lg shadow-brand-600/20"><img src="/icon-512.png" alt="" className="h-full w-full rounded-xl" /></div><div><p className="text-sm font-extrabold tracking-tight text-brand-700 sm:text-base">BikriKoro.Com</p><p className="text-[10px] text-ink-500 sm:text-xs">বাংলাদেশের digital marketplace</p></div></div>
          <button type="button" onClick={finish} className="rounded-full px-3 py-2 text-xs font-bold text-ink-500 transition hover:bg-white hover:text-brand-700">এখন নয়</button>
        </header>

        <main className="flex flex-1 flex-col justify-center py-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:py-12">
          <section key={scene.id} className={reducedMotion ? '' : 'animate-[splash-copy-in_240ms_ease-out]'}>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-brand-700"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-[10px] tracking-normal">{scene.step}</span>{scene.eyebrow}</div>
            <h1 className="mt-5 max-w-2xl text-[clamp(2.25rem,8vw,4.7rem)] font-black leading-[1.04] tracking-[-0.045em] text-ink-900">{scene.title}</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-ink-600 sm:text-base">{scene.description}</p>
            <div className="mt-7 space-y-3">{scene.bullets.map((bullet) => <div key={bullet} className="flex items-center gap-3 text-sm font-semibold text-ink-800"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white"><CheckIcon /></span>{bullet}</div>)}</div>
          </section>

          <section key={`visual-${scene.id}`} className={`mt-10 lg:mt-0 ${reducedMotion ? '' : 'animate-[splash-card-in_280ms_ease-out]'}`} aria-label={`${scene.eyebrow} preview`}><OnboardingVisual scene={scene.id} icon={SceneIcon} /></section>
        </main>

        <footer className="border-t border-brand-100 pt-5"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-1.5" aria-label={`ধাপ ${sceneIndex + 1} / ${scenes.length}`}>{scenes.map((item, index) => <button key={item.id} type="button" onClick={() => setSceneIndex(index)} aria-label={`ধাপ ${index + 1}`} className={`h-1.5 rounded-full transition-all ${index === sceneIndex ? 'w-10 bg-brand-600' : 'w-5 bg-brand-200 hover:bg-brand-400'}`} />)}</div><span className="text-xs font-bold text-ink-500">{sceneIndex + 1} / {scenes.length}</span></div><div className="mt-5 flex gap-3"><button type="button" onClick={goPrevious} disabled={sceneIndex === 0} className="inline-flex items-center gap-2 rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm font-bold text-brand-700 disabled:pointer-events-none disabled:opacity-30"><ArrowLeft size={16} />পিছনে</button><button type="button" onClick={goNext} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">{sceneIndex === scenes.length - 1 ? 'BikriKoro শুরু করি' : 'পরের ধাপ'}<ArrowRight size={17} /></button></div></footer>
      </div>
    </div>}
  </>
}

function CheckIcon() { return <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current stroke-2"><path d="m3 8 3 3 7-7" /></svg> }

function OnboardingVisual({ scene, icon: SceneIcon }: { scene: SceneId; icon: typeof scenes[number]['icon'] }) {
  return <div className="relative mx-auto max-w-md overflow-hidden rounded-[2rem] border border-brand-100 bg-white p-4 shadow-[0_24px_70px_rgba(1,124,80,0.14)] sm:p-6"><div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-50" /><div className="relative"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">BikriKoro experience</p><p className="mt-1 text-lg font-black text-ink-900">বিশ্বাসের সাথে এগিয়ে চলুন</p></div><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white"><SceneIcon size={22} /></span></div>{scene === 'discover' && <DiscoverVisual />}{scene === 'secure' && <SecureVisual />}{scene === 'sell' && <SellVisual />}<div className="mt-5 flex items-center gap-2 rounded-2xl bg-brand-50 px-3 py-3 text-xs font-bold text-brand-700"><BadgeCheck size={16} />স্বচ্ছ, সহজ এবং নিরাপদ marketplace</div></div></div>
}

function DiscoverVisual() { return <div className="mt-8"><div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-[#f8fcfa] p-4"><Search size={19} className="text-brand-600" /><span className="text-sm text-ink-500">আপনি কী খুঁজছেন?</span><span className="ml-auto rounded-xl bg-brand-600 px-3 py-2 text-[10px] font-bold text-white">খুঁজুন</span></div><div className="mt-3 grid grid-cols-3 gap-2"><SmallTile icon={<ShoppingBag size={16} />} label="পণ্য" value="বাছাই" /><SmallTile icon={<Store size={16} />} label="বিক্রেতা" value="বিশ্বস্ত" /><SmallTile icon={<BadgeCheck size={16} />} label="রেটিং" value="দেখুন" /></div></div> }
function SecureVisual() { return <div className="mt-8 space-y-3"><div className="rounded-2xl bg-brand-600 p-5 text-white"><div className="flex items-center justify-between"><ShieldCheck size={30} /><span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold">সুরক্ষিত</span></div><p className="mt-6 text-lg font-extrabold">পেমেন্ট যাচাই হচ্ছে</p><div className="mt-3 h-2 rounded-full bg-white/20"><div className="h-2 w-3/4 rounded-full bg-white" /></div></div><div className="grid grid-cols-2 gap-3"><SmallTile icon={<WalletCards size={16} />} label="Wallet" value="স্বচ্ছ হিসাব" /><SmallTile icon={<BellRing size={16} />} label="Updates" value="সময়মতো" /></div></div> }
function SellVisual() { return <div className="mt-8"><div className="rounded-2xl border border-brand-100 bg-[#f8fcfa] p-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-100 text-brand-700"><Store size={21} /></span><div><p className="text-xs text-ink-500">আপনার shop</p><p className="text-base font-black text-ink-900">আজই listing তৈরি করুন</p></div></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><SmallTile icon={<ShoppingBag size={16} />} label="Listing" value="সহজ" /><SmallTile icon={<BadgeCheck size={16} />} label="Trust" value="বাড়ান" /><SmallTile icon={<WalletCards size={16} />} label="Sales" value="দেখুন" /></div></div></div> }
function SmallTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-brand-100 bg-white p-3"><span className="text-brand-600">{icon}</span><p className="mt-2 text-[10px] text-ink-500">{label}</p><p className="mt-0.5 text-xs font-extrabold text-ink-800">{value}</p></div> }
