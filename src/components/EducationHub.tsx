import { BadgeCheck, CheckCircle2, ChevronRight, FileCheck2, KeyRound, LifeBuoy, PackageCheck, Search, ShieldCheck, Sparkles, Store, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

type EducationType = 'USER_EDU' | 'SELLER_EDU'
type EducationRow = { id: string; title: string; excerpt: string; body: string; cover_image_url: string | null; updated_at: string }
type Section = { heading: string; paragraphs: string[] }

type HubConfig = {
  eyebrow: string
  title: string
  description: string
  accent: string
  softAccent: string
  topics: Array<{ label: string; detail: string; icon: LucideIcon }>
  action: string
  actionPath: string
  illustrationTitle: string
  illustrationText: string
  emptyText: string
}

const CONFIG: Record<EducationType, HubConfig> = {
  USER_EDU: {
    eyebrow: 'Buyer learning path',
    title: 'নিরাপদে কিনুন, বুঝে সিদ্ধান্ত নিন',
    description: 'Account, digital product, payment, delivery ও dispute—সবকিছু সহজ Bengali guide-এ শিখুন।',
    accent: 'bg-[#017C50] text-white',
    softAccent: 'bg-[#E7F6EF] text-[#0E6044]',
    topics: [
      { label: 'খুঁজে নিন', detail: 'Search ও category দিয়ে', icon: Search },
      { label: 'নিরাপদে পেমেন্ট', detail: 'Escrow flow বুঝুন', icon: ShieldCheck },
      { label: 'Access যাচাই', detail: 'Delivery পেয়ে confirm', icon: CheckCircle2 },
    ],
    action: 'Digital product দেখুন',
    actionPath: '/products',
    illustrationTitle: 'Buyer journey',
    illustrationText: 'খোঁজা থেকে confirmation পর্যন্ত',
    emptyText: 'এই গাইডে এখনো কোনো অধ্যায় নেই।',
  },
  SELLER_EDU: {
    eyebrow: 'Seller learning path',
    title: 'ভালো seller হোন, বিশ্বাস তৈরি করুন',
    description: 'Verification, listing, stock, automatic delivery, order fulfillment ও payout—seller journey ধাপে ধাপে শিখুন।',
    accent: 'bg-[#017C50] text-white',
    softAccent: 'bg-[#E7F6EF] text-[#0E6044]',
    topics: [
      { label: 'Verification', detail: 'Type অনুযায়ী document', icon: BadgeCheck },
      { label: 'Listing তৈরি', detail: 'সঠিক তথ্য ও stock', icon: FileCheck2 },
      { label: 'Delivery দিন', detail: 'Key, file বা access', icon: KeyRound },
    ],
    action: 'Seller setup দেখুন',
    actionPath: '/become-seller',
    illustrationTitle: 'Seller journey',
    illustrationText: 'Verification থেকে payout পর্যন্ত',
    emptyText: 'এই গাইডে এখনো কোনো অধ্যায় নেই।',
  },
}

function parseSections(body: string): { intro: string[]; sections: Section[] } {
  const lines = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((line) => line.trim())
  const intro: string[] = []
  const sections: Section[] = []
  let current: Section | null = null
  let paragraphLines: string[] = []

  const flushParagraph = () => {
    const paragraph = paragraphLines.join('\n').trim()
    if (paragraph) {
      if (current) current.paragraphs.push(paragraph)
      else intro.push(paragraph)
    }
    paragraphLines = []
  }

  for (const line of lines) {
    const headingMatch = line.match(/^(?:[০-৯0-9]+)[.)]\s*(.+)$/)
    if (headingMatch) {
      flushParagraph()
      if (current) sections.push(current)
      current = { heading: headingMatch[1].trim(), paragraphs: [] }
    } else if (line) {
      paragraphLines.push(line)
    } else {
      flushParagraph()
    }
  }

  flushParagraph()
  if (current) sections.push(current)
  return { intro, sections }
}

function LearningIllustration({ type, coverImage, config }: { type: EducationType; coverImage: string | null; config: HubConfig }) {
  if (coverImage) return <div className="overflow-hidden border border-white/60 bg-white shadow-[0_18px_50px_rgba(1,124,80,0.16)]"><img src={coverImage} alt="" className="h-full min-h-56 w-full object-cover" loading="lazy" /></div>
  const iconSet = type === 'SELLER_EDU' ? [BadgeCheck, PackageCheck, KeyRound] : [Search, ShieldCheck, LifeBuoy]
  return <div className="relative min-h-56 overflow-hidden border border-brand-100 bg-white p-5 shadow-[0_18px_50px_rgba(1,124,80,0.16)]"><div className="absolute -right-8 -top-10 h-40 w-40 border-[22px] border-brand-100/80" /><div className="absolute -bottom-12 -left-10 h-36 w-36 border-[18px] border-brand-50" /><div className="relative flex h-full min-h-48 flex-col justify-between"><div className="flex items-center justify-between"><span className="flex h-12 w-12 items-center justify-center bg-brand-500 text-white"><Sparkles size={23} /></span><span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">BikriKoro</span></div><div><p className="text-xs font-semibold text-ink-500">{config.illustrationTitle}</p><p className="mt-1 text-lg font-bold text-ink-900">{config.illustrationText}</p></div><div className="grid grid-cols-3 gap-2">{iconSet.map((Icon, index) => <div key={index} className={`flex h-14 items-center justify-center ${index === 1 ? 'bg-brand-500 text-white' : 'bg-brand-50 text-brand-700'}`}><Icon size={22} /></div>)}</div></div></div>
}

export function EducationHub({ type, rows }: { type: EducationType; rows: EducationRow[] }) {
  const config = CONFIG[type]
  const primary = rows[0]
  const parsed = primary ? parseSections(primary.body) : { intro: [], sections: [] }
  const sectionCount = parsed.sections.length

  return <div className="space-y-6">
    <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <div className={`${config.accent} relative overflow-hidden p-6 sm:p-9`}><div className="absolute -right-16 -top-16 h-52 w-52 border-[28px] border-white/10" /><div className="relative"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-50/80">{config.eyebrow}</p><h2 className="mt-3 max-w-xl text-3xl font-bold leading-tight sm:text-4xl">{config.title}</h2><p className="mt-4 max-w-xl text-sm leading-7 text-brand-50/90 sm:text-base">{config.description}</p><div className="mt-6 flex flex-wrap gap-3"><Link to={config.actionPath} className="inline-flex items-center gap-2 bg-white px-4 py-3 text-base font-bold text-brand-700 transition hover:bg-brand-50">{config.action}<ChevronRight size={17} /></Link><span className="inline-flex items-center gap-2 border border-white/30 px-4 py-3 text-sm font-semibold text-white"><BookIcon />{sectionCount > 0 ? `${sectionCount}টি chapter` : 'Chapter প্রকাশের অপেক্ষায়'}</span></div></div></div>
      <LearningIllustration type={type} coverImage={primary?.cover_image_url ?? null} config={config} />
    </section>

    <section className="grid gap-3 md:grid-cols-3">{config.topics.map(({ label, detail, icon: Icon }) => <div key={label} className={`${config.softAccent} flex items-center gap-3 border border-brand-100 p-4`}><span className="flex h-11 w-11 shrink-0 items-center justify-center bg-white text-brand-700"><Icon size={21} /></span><div><p className="text-sm font-bold">{label}</p><p className="mt-1 text-xs opacity-80">{detail}</p></div></div>)}</section>

    {primary && parsed.intro.length > 0 && <section className="border border-brand-100 bg-brand-50/60 p-5 sm:p-6"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center bg-brand-500 text-white"><Store size={18} /></span><p className="text-sm leading-7 text-ink-700">{parsed.intro.join('\n\n')}</p></div></section>}

    {!primary ? <section className="border border-dashed border-outline bg-surface p-10 text-center"><BookIcon className="mx-auto text-brand-400" /><h3 className="mt-3 text-lg font-bold text-ink-900">শেখার কনটেন্ট আসছে</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-600">{config.emptyText}</p></section> : <section className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="h-fit border border-outline bg-surface p-4 lg:sticky lg:top-24"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Chapter index</p><nav className="mt-3 space-y-1">{parsed.sections.map((section, index) => <a key={section.heading} href={`#chapter-${index + 1}`} className="flex items-start gap-2 border-l-2 border-transparent px-2 py-2 text-sm leading-5 text-ink-600 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"><span className="font-bold text-brand-600">{String(index + 1).padStart(2, '0')}</span><span>{section.heading}</span></a>)}</nav></aside>
      <div className="space-y-3">{parsed.sections.map((section, index) => <details key={section.heading} id={`chapter-${index + 1}`} open={index === 0} className="group scroll-mt-24 border border-outline bg-surface"><summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden"><span className="flex h-10 w-10 shrink-0 items-center justify-center bg-brand-50 text-sm font-bold text-brand-700">{String(index + 1).padStart(2, '0')}</span><span className="flex-1 text-base font-bold text-ink-900 sm:text-lg">{section.heading}</span><ChevronRight size={18} className="text-ink-400 transition group-open:rotate-90" /></summary><div className="border-t border-outline px-5 pb-6 pt-4 sm:px-20">{section.paragraphs.map((paragraph) => <p key={paragraph.slice(0, 40)} className="mb-4 whitespace-pre-line text-sm leading-7 text-ink-700 last:mb-0">{paragraph}</p>)}</div></details>)}</div>
    </section>}

    {primary && <div className="flex flex-col gap-3 border-t border-outline pt-5 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between"><p>সর্বশেষ আপডেট: {new Date(primary.updated_at).toLocaleDateString('bn-BD')}</p><Link to="/settings" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">আরও Help ও Settings দেখুন <ChevronRight size={15} /></Link></div>}
  </div>
}

function BookIcon({ className = '' }: { className?: string }) { return <span className={`inline-flex h-5 w-5 items-center justify-center border-2 border-current text-[10px] font-bold ${className}`}>BK</span> }
