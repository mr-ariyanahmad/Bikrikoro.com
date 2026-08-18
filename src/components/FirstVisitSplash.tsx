import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BadgeCheck, BellRing, CheckCircle2, CreditCard, Search, ShieldCheck, ShoppingBag, Sparkles, Store } from 'lucide-react'
import { WELCOME_SPLASH_REPLAY_EVENT, WELCOME_SPLASH_STORAGE_KEY } from '@/lib/welcomeSplash'

const scenes = [
  {
    eyebrow: 'BikriKoro.Com-এ স্বাগতম',
    title: 'কেনাকাটা হোক সহজ, বিক্রি হোক নিশ্চিন্তে',
    description: 'বাংলাদেশের মানুষের জন্য তৈরি আপনার নিজের ডিজিটাল marketplace—ভালো পণ্য খুঁজুন, বিশ্বাসযোগ্য seller বেছে নিন এবং সহজে অর্ডার করুন।',
    support: 'এক জায়গায় পণ্য, seller এবং নিরাপদ লেনদেন',
    icon: ShoppingBag,
    visual: 'marketplace',
  },
  {
    eyebrow: 'সহজে খুঁজে নিন',
    title: 'আপনার পছন্দের পণ্য কয়েক মুহূর্তেই',
    description: 'Category, location, price এবং product type দিয়ে খুঁজুন। Compare করুন, seller profile দেখুন এবং নিজের পছন্দের পণ্য save করে রাখুন।',
    support: 'Search, filter, compare এবং recommendation—সব একসাথে',
    icon: Search,
    visual: 'discover',
  },
  {
    eyebrow: 'নিরাপদ লেনদেন',
    title: 'Escrow সুরক্ষায় আপনার টাকা',
    description: 'Payment সম্পন্ন হলেও পণ্য বা সেবা নিশ্চিত হওয়ার আগে seller-এর কাছে টাকা পৌঁছায় না। Order status, support এবং dispute সবকিছু পরিষ্কারভাবে দেখতে পারবেন।',
    support: 'Payment থেকে delivery পর্যন্ত প্রতিটি ধাপে স্বচ্ছতা',
    icon: ShieldCheck,
    visual: 'secure',
  },
  {
    eyebrow: 'বিশ্বাসযোগ্য seller',
    title: 'ভালো seller-কে সহজে চিনে নিন',
    description: 'Verification badge, rating, review এবং seller profile দেখে সিদ্ধান্ত নিন। আপনি চাইলে physical বা digital product বিক্রির জন্য নিজের seller journey শুরু করতে পারবেন।',
    support: 'Verified seller, honest review এবং responsible marketplace',
    icon: Store,
    visual: 'seller',
  },
  {
    eyebrow: 'সব খবর সময়মতো',
    title: 'BikriKoro-এর সাথে যুক্ত থাকুন',
    description: 'Order, payment, chat, verification, wallet এবং গুরুত্বপূর্ণ marketplace update-এর খবর পেতে notification চালু রাখুন। এখন আপনি প্রস্তুত।',
    support: 'আপনার নিরাপদ কেনাকাটার যাত্রা আজ থেকেই শুরু হোক',
    icon: BellRing,
    visual: 'notifications',
  },
] as const

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
    if (!visible) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
      if (event.key === 'ArrowRight') goNext()
      if (event.key === 'ArrowLeft') goPrevious()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const finish = () => {
    try { window.localStorage.setItem(WELCOME_SPLASH_STORAGE_KEY, '1') } catch { /* private browsing may block storage */ }
    setClosing(true)
    window.setTimeout(() => setVisible(false), reducedMotion ? 0 : 260)
  }

  const goNext = () => {
    if (sceneIndex === scenes.length - 1) finish()
    else setSceneIndex((index) => index + 1)
  }

  const goPrevious = () => setSceneIndex((index) => Math.max(0, index - 1))

  const scene = scenes[sceneIndex]
  const SceneIcon = scene.icon

  return (
    <>
      {children}
      {visible && (
        <div className={`fixed inset-0 z-[100] min-h-[100dvh] overflow-y-auto bg-ink-900 text-white transition-opacity duration-300 ${closing ? 'pointer-events-none opacity-0' : 'opacity-100'}`} role="dialog" aria-modal="true" aria-label="BikriKoro স্বাগত পরিচিতি">
          <div className="pointer-events-none fixed -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand-500/20 blur-3xl" />
          <div className="pointer-events-none fixed -bottom-48 -right-40 h-[34rem] w-[34rem] rounded-full bg-brand-300/15 blur-3xl" />
          <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1440px] flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
            <header className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1.5 shadow-lg shadow-black/10 sm:h-11 sm:w-11"><img src="/icon-512.png" alt="" className="h-full w-full rounded-lg" /></div>
                <div><p className="text-sm font-bold tracking-tight">BikriKoro.Com</p><p className="text-[10px] text-white/55">বাংলাদেশের ডিজিটাল marketplace</p></div>
              </div>
              <button type="button" onClick={finish} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 transition hover:border-white/30 hover:bg-white/10 hover:text-white">এড়িয়ে যান</button>
            </header>

            <main className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-10">
              <div className={`order-2 lg:order-1 ${reducedMotion ? '' : 'animate-[splash-copy-in_420ms_ease-out]'}`} key={`copy-${sceneIndex}`}>
                <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-brand-200"><SceneIcon size={17} />{scene.eyebrow}</div>
                <h1 className="max-w-2xl text-[2.25rem] font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-[4.2rem]">{scene.title}</h1>
                <p className="mt-6 max-w-xl text-sm leading-7 text-white/70 sm:text-base sm:leading-8">{scene.description}</p>
                <div className="mt-7 flex max-w-xl items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-sm leading-6 text-white/85 backdrop-blur-sm"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-brand-300" />{scene.support}</div>
              </div>

              <div className={`order-1 flex min-h-[18rem] items-center justify-center lg:order-2 lg:min-h-[30rem] ${reducedMotion ? '' : 'animate-[splash-card-in_520ms_ease-out]'}`} key={`visual-${sceneIndex}`}>
                <VisualPanel scene={scene.visual} icon={SceneIcon} />
              </div>
            </main>

            <footer className="flex flex-col gap-5 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2" aria-label={`স্বাগত পেজ ${sceneIndex + 1} / ${scenes.length}`}>
                {scenes.map((item, index) => <button key={item.eyebrow} type="button" onClick={() => setSceneIndex(index)} aria-label={`পেজ ${index + 1} দেখুন`} className={`h-2 rounded-full transition-all duration-300 ${index === sceneIndex ? 'w-10 bg-brand-300' : 'w-2 bg-white/25 hover:bg-white/50'}`} />)}
                <span className="ml-2 text-xs text-white/45">{sceneIndex + 1} / {scenes.length}</span>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={goPrevious} disabled={sceneIndex === 0} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/75 transition hover:border-white/30 hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"><ArrowLeft size={16} />পিছনে</button>
                <button type="button" onClick={goNext} className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-brand-400 px-5 py-3 text-sm font-bold text-ink-900 shadow-lg shadow-brand-950/20 transition hover:bg-brand-300">{sceneIndex === scenes.length - 1 ? 'শুরু করি' : 'চালিয়ে যান'}<ArrowRight size={17} /></button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}

function VisualPanel({ scene, icon: SceneIcon }: { scene: typeof scenes[number]['visual']; icon: typeof scenes[number]['icon'] }) {
  return <div className="relative w-full max-w-[30rem]">
    <div className="absolute inset-5 rounded-[3rem] bg-brand-400/20 blur-3xl" />
    <div className="relative overflow-hidden rounded-[2.5rem] border border-white/15 bg-gradient-to-br from-white/15 via-brand-500/25 to-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur-md sm:p-8">
      <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full border border-white/10" />
      <div className="absolute -bottom-24 -left-16 h-52 w-52 rounded-full border border-white/10" />
      {scene === 'marketplace' && <MarketplaceVisual />}
      {scene === 'discover' && <DiscoverVisual />}
      {scene === 'secure' && <SecureVisual />}
      {scene === 'seller' && <SellerVisual />}
      {scene === 'notifications' && <NotificationVisual />}
      <div className="relative mt-6 flex items-center justify-between border-t border-white/10 pt-5"><div><p className="text-xs font-semibold text-white/55">BikriKoro experience</p><p className="mt-1 text-sm font-bold text-white">বিশ্বাসের সাথে এগিয়ে চলুন</p></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-300 text-ink-900"><SceneIcon size={21} /></span></div>
    </div>
  </div>
}

function MarketplaceVisual() {
  return <div className="relative grid grid-cols-2 gap-3 pt-3"><div className="col-span-2 flex items-center gap-3 rounded-2xl bg-white p-3 text-ink-900 shadow-lg"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><ShoppingBag size={19} /></span><div className="flex-1"><p className="text-[10px] font-semibold text-ink-400">আজকের marketplace</p><p className="mt-0.5 text-sm font-bold">পছন্দের পণ্য খুঁজুন</p></div><Sparkles size={17} className="text-brand-500" /></div><MiniCard label="Digital" value="সহজ delivery" icon={<CreditCard size={17} />} /><MiniCard label="Physical" value="নিরাপদ order" icon={<Store size={17} />} /></div>
}

function DiscoverVisual() {
  return <div className="relative space-y-3 pt-3"><div className="flex items-center gap-2 rounded-2xl bg-white p-3 text-ink-500 shadow-lg"><Search size={17} className="text-brand-600" /><span className="text-xs">আপনি কী খুঁজছেন?</span><span className="ml-auto rounded-lg bg-brand-500 px-3 py-1.5 text-[10px] font-bold text-white">খুঁজুন</span></div><div className="grid grid-cols-3 gap-2"><MiniCard label="Category" value="বাছাই" icon={<ShoppingBag size={16} />} /><MiniCard label="Location" value="কাছাকাছি" icon={<Search size={16} />} /><MiniCard label="Price" value="তুলনা" icon={<CreditCard size={16} />} /></div><div className="rounded-2xl border border-white/15 bg-ink-900/35 p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-white/60">আপনার জন্য পছন্দ</p><BadgeCheck size={17} className="text-brand-300" /></div><div className="mt-3 flex gap-2"><span className="h-16 flex-1 rounded-xl bg-gradient-to-br from-brand-300/70 to-brand-700/70" /><span className="h-16 flex-1 rounded-xl bg-gradient-to-br from-amber-200/70 to-brand-700/70" /><span className="h-16 flex-1 rounded-xl bg-gradient-to-br from-sky-200/70 to-brand-700/70" /></div></div></div>
}

function SecureVisual() {
  return <div className="relative flex flex-col items-center pt-3"><div className="relative flex h-44 w-44 items-center justify-center rounded-full border border-brand-200/40 bg-brand-300/15"><div className="absolute inset-4 rounded-full border border-white/15" /><div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white text-brand-600 shadow-2xl"><ShieldCheck size={48} /></div></div><div className="mt-5 grid w-full grid-cols-3 gap-2"><MiniCard label="Payment" value="সুরক্ষিত" icon={<CreditCard size={16} />} /><MiniCard label="Order" value="ট্র্যাক" icon={<ShoppingBag size={16} />} /><MiniCard label="Support" value="সহায়তা" icon={<BellRing size={16} />} /></div></div>
}

function SellerVisual() {
  return <div className="relative space-y-3 pt-3"><div className="flex items-center gap-3 rounded-2xl bg-white p-4 text-ink-900 shadow-lg"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Store size={22} /></div><div className="flex-1"><p className="text-sm font-bold">Verified seller</p><div className="mt-1 flex items-center gap-1 text-[10px] text-brand-700"><BadgeCheck size={13} />পরিচয় যাচাইকৃত</div></div><span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700">বিশ্বাস</span></div><div className="grid grid-cols-2 gap-3"><MiniCard label="Rating" value="ভালো review" icon={<BadgeCheck size={17} />} /><MiniCard label="Seller Hub" value="শিখুন" icon={<Store size={17} />} /></div><div className="rounded-2xl border border-brand-200/20 bg-brand-300/10 p-4 text-xs leading-5 text-white/75">আপনার ব্যবসার ধরন অনুযায়ী সঠিক verification এবং seller guide পাবেন।</div></div>
}

function NotificationVisual() {
  return <div className="relative space-y-3 pt-3"><div className="flex items-center gap-3 rounded-2xl bg-white p-4 text-ink-900 shadow-lg"><div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><BellRing size={23} /><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-400" /></div><div className="flex-1"><p className="text-sm font-bold">সব update সময়মতো</p><p className="mt-1 text-[10px] text-ink-500">Order, chat, payment ও wallet</p></div></div><div className="space-y-2"><NotificationRow title="Payment update" text="আপনার payment নিরাপদে গ্রহণ হয়েছে" /><NotificationRow title="Seller message" text="আপনার প্রশ্নের উত্তর এসেছে" /><NotificationRow title="Order status" text="আপনার order পথে আছে" /></div></div>
}

function MiniCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.09] p-3"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 text-brand-200">{icon}</span><p className="mt-3 text-[10px] text-white/55">{label}</p><p className="mt-0.5 text-xs font-bold text-white">{value}</p></div>
}

function NotificationRow({ title, text }: { title: string; text: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] p-3"><span className="h-2.5 w-2.5 rounded-full bg-brand-300" /><div><p className="text-xs font-bold text-white">{title}</p><p className="mt-0.5 text-[10px] text-white/55">{text}</p></div></div>
}
