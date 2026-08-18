import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, BadgeCheck, BellRing, CheckCircle2, MapPin, Search, ShieldCheck, ShoppingBag, Sparkles, Store } from 'lucide-react'
import { WELCOME_SPLASH_REPLAY_EVENT, WELCOME_SPLASH_STORAGE_KEY } from '@/lib/welcomeSplash'

const scenes = [
  {
    id: 'marketplace',
    eyebrow: 'BikriKoro.Com-এ স্বাগতম',
    title: ['কেনাকাটা হোক সহজ,', 'বিক্রি হোক নিশ্চিন্তে'],
    description: 'ভালো পণ্য খুঁজুন, বিশ্বাসযোগ্য seller বেছে নিন এবং নিরাপদে order করুন—সবকিছু এক জায়গায়।',
    icon: ShoppingBag,
    highlights: [
      { label: 'সহজে খুঁজুন', icon: Search },
      { label: 'নিরাপদ লেনদেন', icon: ShieldCheck },
      { label: 'বিশ্বাসযোগ্য seller', icon: Store },
      { label: 'সব update সময়মতো', icon: BellRing },
    ],
  },
  {
    id: 'discover',
    eyebrow: 'সহজে খুঁজে নিন',
    title: ['আপনার পছন্দের পণ্য', 'কয়েক মুহূর্তেই'],
    description: 'Category, location, price এবং product type দিয়ে খুঁজুন। Compare করুন এবং আপনার পছন্দের পণ্য save করে রাখুন।',
    icon: Search,
    highlights: [
      { label: 'Smart search', icon: Search },
      { label: 'Category filter', icon: ShoppingBag },
      { label: 'কাছের seller', icon: MapPin },
      { label: 'সহজ comparison', icon: CheckCircle2 },
    ],
  },
  {
    id: 'secure',
    eyebrow: 'নিরাপদ লেনদেন',
    title: ['আপনার order থাকুক', 'সুরক্ষিত ও স্বচ্ছ'],
    description: 'Payment থেকে delivery পর্যন্ত প্রতিটি ধাপে order status, support এবং dispute information পরিষ্কারভাবে দেখতে পারবেন।',
    icon: ShieldCheck,
    highlights: [
      { label: 'Secure payment', icon: ShieldCheck },
      { label: 'Order tracking', icon: ShoppingBag },
      { label: 'Escrow protection', icon: CheckCircle2 },
      { label: 'দ্রুত support', icon: BellRing },
    ],
  },
  {
    id: 'seller',
    eyebrow: 'বিশ্বাসযোগ্য seller',
    title: ['ভালো seller-কে', 'সহজে চিনে নিন'],
    description: 'Verification badge, rating, review এবং seller profile দেখে সিদ্ধান্ত নিন। আপনার ব্যবসার ধরন অনুযায়ী seller journey শুরু করুন।',
    icon: Store,
    highlights: [
      { label: 'Verified badge', icon: BadgeCheck },
      { label: 'সত্যিকারের review', icon: CheckCircle2 },
      { label: 'Seller profile', icon: Store },
      { label: 'Seller guide', icon: ShoppingBag },
    ],
  },
  {
    id: 'notifications',
    eyebrow: 'সব খবর সময়মতো',
    title: ['BikriKoro-এর সাথে', 'যুক্ত থাকুন'],
    description: 'Order, payment, chat, verification, wallet এবং গুরুত্বপূর্ণ marketplace update-এর খবর পেতে notification চালু রাখুন।',
    icon: BellRing,
    highlights: [
      { label: 'Order update', icon: ShoppingBag },
      { label: 'Chat message', icon: BellRing },
      { label: 'Payment alert', icon: CheckCircle2 },
      { label: 'Wallet activity', icon: ShieldCheck },
    ],
  },
] as const

type SceneId = (typeof scenes)[number]['id']

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
      if (event.key === 'Enter' || event.key === 'ArrowRight') goNext()
      if (event.key === 'ArrowLeft') goPrevious()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  const finish = () => {
    try { window.localStorage.setItem(WELCOME_SPLASH_STORAGE_KEY, '1') } catch { /* private browsing may block storage */ }
    setClosing(true)
    window.setTimeout(() => setVisible(false), reducedMotion ? 0 : 220)
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
        <div className={`fixed inset-0 z-[100] h-[100dvh] w-full overflow-hidden bg-white text-ink-900 transition-opacity duration-300 ${closing ? 'pointer-events-none opacity-0' : 'opacity-100'}`} role="dialog" aria-modal="true" aria-label="BikriKoro স্বাগত পরিচিতি">
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
              <section key={`copy-${scene.id}`} className={`min-h-0 shrink-0 ${reducedMotion ? '' : 'animate-[splash-copy-in_240ms_ease-out]'}`}>
                <div className="flex items-center gap-2 text-xs font-bold text-brand-700 sm:text-sm"><SceneIcon size={17} />{scene.eyebrow}</div>
                <h1 className="mt-2 max-w-2xl text-[clamp(1.75rem,7vw,3.8rem)] font-bold leading-[1.08] tracking-tight text-ink-900">{scene.title.map((line, index) => <span key={line} className={`block ${index === scene.title.length - 1 ? 'text-brand-600' : ''}`}>{line}</span>)}</h1>
                <p className="mt-3 max-w-xl text-xs leading-5 text-ink-600 sm:mt-4 sm:text-sm sm:leading-6 lg:text-base">{scene.description}</p>
                <div className="mt-3 grid max-w-xl grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
                  {scene.highlights.map(({ label, icon: Icon }) => <div key={label} className="flex min-w-0 items-center gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-2.5 py-2 text-[11px] font-semibold text-brand-700 sm:rounded-2xl sm:px-3 sm:py-2.5 sm:text-xs"><Icon size={15} className="shrink-0 text-brand-600" /> <span className="truncate">{label}</span></div>)}
                </div>
              </section>

              <section key={`visual-${scene.id}`} className={`flex min-h-0 min-h-[12rem] max-h-[34vh] items-center justify-center lg:min-h-[22rem] lg:max-h-none ${reducedMotion ? '' : 'animate-[splash-card-in_280ms_ease-out]'}`} aria-label={`${scene.eyebrow} preview`}>
                <VisualPanel scene={scene.id} icon={SceneIcon} />
              </section>
            </main>

            <footer className="flex shrink-0 flex-col gap-3 border-t border-brand-100 pt-3 sm:gap-4 sm:pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-ink-500"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" /><span className="truncate">আপনার নিরাপদ marketplace journey শুরু হোক আজ</span></div>
                <div className="flex shrink-0 items-center gap-1.5" aria-label={`স্বাগত পেজ ${sceneIndex + 1} / ${scenes.length}`}>
                  {scenes.map((item, index) => <button key={item.id} type="button" onClick={() => setSceneIndex(index)} aria-label={`পেজ ${index + 1} দেখুন`} aria-current={index === sceneIndex ? 'step' : undefined} className={`h-2 rounded-full transition-all duration-200 ${index === sceneIndex ? 'w-7 bg-brand-500' : 'w-2 bg-brand-100 hover:bg-brand-300'}`} />)}
                  <span className="ml-1 text-[10px] font-semibold text-ink-500">{sceneIndex + 1}/{scenes.length}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button type="button" onClick={goPrevious} disabled={sceneIndex === 0} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-brand-100 bg-white px-3 py-2.5 text-xs font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-50 disabled:pointer-events-none disabled:opacity-30 sm:px-4 sm:text-sm"><ArrowLeft size={15} />পিছনে</button>
                <button type="button" onClick={goNext} className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 sm:text-base">{sceneIndex === scenes.length - 1 ? 'শুরু করি' : 'চালিয়ে যান'} <ArrowRight size={17} /></button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}

function VisualPanel({ scene, icon: SceneIcon }: { scene: SceneId; icon: typeof scenes[number]['icon'] }) {
  return <div className="relative w-full max-w-md rounded-[2rem] border border-brand-100 bg-brand-50/70 p-3 shadow-[0_18px_50px_rgba(1,124,80,0.12)] sm:p-5">
    {scene === 'marketplace' && <MarketplaceVisual />}
    {scene === 'discover' && <DiscoverVisual />}
    {scene === 'secure' && <SecureVisual />}
    {scene === 'seller' && <SellerVisual />}
    {scene === 'notifications' && <NotificationVisual />}
    <div className="mt-2 flex items-center justify-between gap-3 border-t border-brand-100 pt-2.5 sm:mt-3 sm:pt-3"><div className="min-w-0"><p className="text-[10px] font-semibold text-ink-500 sm:text-xs">BikriKoro experience</p><p className="truncate text-xs font-bold text-brand-700 sm:text-sm">বিশ্বাসের সাথে এগিয়ে চলুন</p></div><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white sm:h-10 sm:w-10"><SceneIcon size={18} /></span></div>
  </div>
}

function MarketplaceVisual() {
  return <><div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm sm:p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><ShoppingBag size={18} /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold text-ink-500 sm:text-xs">আজকের marketplace</p><p className="truncate text-sm font-bold text-ink-900 sm:text-base">পছন্দের পণ্য খুঁজুন</p></div><Sparkles size={18} className="shrink-0 text-brand-500" /></div><div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:gap-3"><MiniCard label="Digital" value="সহজ delivery" icon={<CreditBadge />} /><MiniCard label="Physical" value="নিরাপদ order" icon={<Store size={19} />} /></div><div className="mt-2 flex items-center gap-2 rounded-2xl bg-brand-600 px-3 py-2.5 text-white sm:mt-3 sm:px-4 sm:py-3"><CheckCircle2 size={17} className="shrink-0 text-brand-100" /><p className="text-xs font-semibold sm:text-sm">এক জায়গায় পণ্য, seller এবং নিরাপদ লেনদেন</p></div></>
}

function DiscoverVisual() {
  return <><div className="flex items-center gap-2 rounded-2xl border border-brand-100 bg-white p-3 text-ink-500 shadow-sm"><Search size={17} className="shrink-0 text-brand-600" /><span className="truncate text-xs">আপনি কী খুঁজছেন?</span><span className="ml-auto rounded-lg bg-brand-500 px-2.5 py-1.5 text-[10px] font-bold text-white">খুঁজুন</span></div><div className="mt-2 grid grid-cols-3 gap-2"><MiniCard label="Category" value="বাছাই" icon={<ShoppingBag size={16} />} /><MiniCard label="Location" value="কাছাকাছি" icon={<MapPin size={16} />} /><MiniCard label="Price" value="তুলনা" icon={<CheckCircle2 size={16} />} /></div><div className="mt-2 flex items-center justify-between rounded-2xl border border-brand-100 bg-white p-3"><div><p className="text-[10px] font-semibold text-ink-500">আপনার জন্য পছন্দ</p><p className="mt-0.5 text-xs font-bold text-brand-700">সঠিক পণ্য সহজে বাছাই করুন</p></div><BadgeCheck size={21} className="text-brand-600" /></div></>
}

function SecureVisual() {
  return <><div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm sm:p-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><ShieldCheck size={28} /></div><div><p className="text-sm font-bold text-ink-900">Payment সুরক্ষিত</p><p className="mt-0.5 text-[10px] text-ink-500">Order নিশ্চিত না হওয়া পর্যন্ত</p></div><CheckCircle2 size={20} className="ml-auto text-brand-600" /></div><div className="mt-2 grid grid-cols-3 gap-2"><MiniCard label="Payment" value="নিরাপদ" icon={<ShieldCheck size={16} />} /><MiniCard label="Order" value="ট্র্যাক" icon={<ShoppingBag size={16} />} /><MiniCard label="Support" value="সহায়তা" icon={<BellRing size={16} />} /></div><div className="mt-2 rounded-2xl bg-brand-600 px-3 py-2.5 text-xs font-semibold text-white">Payment থেকে delivery পর্যন্ত স্বচ্ছতা</div></>
}

function SellerVisual() {
  return <><div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm sm:p-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Store size={22} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink-900">Verified seller</p><div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-brand-700"><BadgeCheck size={13} />পরিচয় যাচাইকৃত</div></div><span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700">বিশ্বাস</span></div><div className="mt-2 grid grid-cols-2 gap-2"><MiniCard label="Rating" value="ভালো review" icon={<BadgeCheck size={17} />} /><MiniCard label="Seller Hub" value="শিখুন" icon={<Store size={17} />} /></div><div className="mt-2 rounded-2xl border border-brand-100 bg-white p-3 text-xs leading-5 text-ink-600">আপনার ব্যবসার ধরন অনুযায়ী সঠিক verification এবং seller guide পাবেন।</div></>
}

function NotificationVisual() {
  return <><div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm sm:p-4"><div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><BellRing size={22} /><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-400" /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-ink-900">সব update সময়মতো</p><p className="mt-1 truncate text-[10px] text-ink-500">Order, chat, payment ও wallet</p></div></div><div className="mt-2 space-y-1.5"><NotificationRow title="Payment update" text="আপনার payment নিরাপদে গ্রহণ হয়েছে" /><NotificationRow title="Seller message" text="আপনার প্রশ্নের উত্তর এসেছে" /><NotificationRow title="Order status" text="আপনার order পথে আছে" /></div></>
}

function MiniCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-brand-100 bg-white p-2.5 sm:p-3"><span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</span><p className="mt-2 text-[10px] text-ink-500">{label}</p><p className="mt-0.5 truncate text-xs font-bold text-brand-700">{value}</p></div>
}

function NotificationRow({ title, text }: { title: string; text: string }) {
  return <div className="flex items-center gap-2 rounded-xl border border-brand-100 bg-white px-3 py-2"><span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" /><div className="min-w-0"><p className="truncate text-[11px] font-bold text-ink-900">{title}</p><p className="truncate text-[10px] text-ink-500">{text}</p></div></div>
}

function CreditBadge() {
  return <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-50 text-brand-700"><span className="h-2.5 w-3.5 rounded-sm border-2 border-current" /></span>
}
