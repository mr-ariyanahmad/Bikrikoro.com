import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Globe2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Placement = 'HOME' | 'SEARCH' | 'SELLER_EDU' | 'SELLER_DASHBOARD'
export type CommunityLink = { id: string; platform: 'WHATSAPP' | 'FACEBOOK' | 'TELEGRAM' | 'OTHER'; title: string; description: string; url: string; image_url: string | null; placements: string[]; status: string; sort_order: number }

const ACCENTS = { WHATSAPP: 'bg-brand-50 text-brand-700 border-brand-100', FACEBOOK: 'bg-brand-50 text-brand-700 border-brand-100', TELEGRAM: 'bg-brand-50 text-brand-700 border-brand-100', OTHER: 'bg-brand-50 text-brand-700 border-brand-100' }
const PLATFORM_META = {
  WHATSAPP: { label: 'WhatsApp group', action: 'WhatsApp-এ যোগ দিন', gradient: 'from-[#128c4a] to-[#075e35]', iconClass: 'bg-white/15 text-white' },
  FACEBOOK: { label: 'Facebook community', action: 'Facebook-এ যোগ দিন', gradient: 'from-brand-600 to-brand-700', iconClass: 'bg-white/15 text-white' },
  TELEGRAM: { label: 'Telegram channel', action: 'Telegram-এ যোগ দিন', gradient: 'from-brand-400 to-brand-600', iconClass: 'bg-white/15 text-white' },
  OTHER: { label: 'BikriKoro community', action: 'Open community', gradient: 'from-brand-500 to-brand-700', iconClass: 'bg-white/15 text-white' },
} as const

export function CommunityLinks({ placement, popup = false, compact = false }: { placement: Placement; popup?: boolean; compact?: boolean }) {
  const [links, setLinks] = useState<CommunityLink[]>([])
  const [showPopup, setShowPopup] = useState(false)
  useEffect(() => {
    let active = true
    supabase.rpc('get_published_community_links', { p_placement: placement }).then(({ data, error }) => {
      if (error) console.error('Community links load failed:', error)
      if (!active) return
      const next = (data ?? []) as CommunityLink[]
      setLinks(next)
      if (popup && next.some((link) => link.platform === 'WHATSAPP')) {
        const dismissed = window.sessionStorage.getItem('bikrikoro:seller-community-popup-dismissed')
        if (!dismissed) setShowPopup(true)
      }
    })
    return () => { active = false }
  }, [placement, popup])

  const visible = useMemo(() => links.slice(0, compact ? 2 : 6), [compact, links])
  if (visible.length === 0) return null
  return <>
    <section className={compact ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'}>
      {!compact && <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">BikriKoro কমিউনিটি</p><h2 className="mt-1 text-xl font-extrabold text-ink-900">আমাদের সাথে যুক্ত থাকুন</h2></div>}
      <div className={compact ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3 md:grid-cols-2'}>{visible.map((link) => <CommunityLinkCard key={link.id} link={link} compact={compact} />)}</div>
    </section>
    {showPopup && <CommunityPopup link={links.find((link) => link.platform === 'WHATSAPP') ?? links[0]} onClose={() => { window.sessionStorage.setItem('bikrikoro:seller-community-popup-dismissed', '1'); setShowPopup(false) }} />}
  </>
}

function PlatformLogo({ platform, size = 25 }: { platform: CommunityLink['platform']; size?: number }) {
  if (platform === 'WHATSAPP') return <svg className="text-brand-500" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" fill="none"><path fill="currentColor" d="M16 3.5a12.3 12.3 0 0 0-10.5 19L4 28l5.7-1.5A12.5 12.5 0 1 0 16 3.5Z"/><path fill="white" d="M22.3 18.6c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2l-.8 1c-.2.3-.4.3-.7.1-1.1-.5-2-1.2-2.8-2.2-.2-.3 0-.4.2-.6l.5-.6c.1-.2.2-.3.1-.5l-.9-2.1c-.1-.3-.3-.3-.5-.3h-.5c-.2 0-.5.1-.7.3-.8.8-.8 2 0 3.1 1.7 2.5 4 3.9 6 4.5.8.2 1.4.2 1.9-.1.4-.2.8-.7.9-1.2.1-.2.1-.4-.1-.6Z"/></svg>
  if (platform === 'FACEBOOK') return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="currentColor" /><path fill="white" d="M17.7 25v-7.8h2.6l.4-3h-3v-1.9c0-.9.3-1.5 1.6-1.5h1.7V8.1c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2h-2.6v3h2.6V25h2.9Z" /></svg>
  if (platform === 'TELEGRAM') return <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="currentColor" /><path fill="white" d="m24.3 9.3-3.1 14.6c-.2 1-.8 1.2-1.6.7l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.8.4l.3-4.6 8.3-7.5c.4-.3-.1-.5-.6-.2l-10.3 6.5-4.4-1.4c-1-.3-1-1 .2-1.5l17.2-6.6c.8-.3 1.5.2 1.3 1.3Z" /></svg>
  return <Globe2 size={size} aria-hidden="true" />
}

function CommunityLinkCard({ link, compact }: { link: CommunityLink; compact: boolean }) {
  const accent = ACCENTS[link.platform] ?? ACCENTS.OTHER
  const hasBrandedLogo = link.platform !== 'OTHER'
  return <a href={link.url} target="_blank" rel="noreferrer" className={`group flex items-center gap-3 rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${accent}`}><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/80">{hasBrandedLogo ? <PlatformLogo platform={link.platform} size={29} /> : link.image_url ? <img src={link.image_url} alt="" className="h-full w-full object-cover" /> : <PlatformLogo platform={link.platform} />}</div><div className="min-w-0 flex-1"><p className={`font-extrabold ${compact ? 'text-sm' : 'text-base'}`}>{link.title}</p><p className="mt-0.5 text-[11px] font-semibold opacity-75">{PLATFORM_META[link.platform].label}</p>{!compact && link.description && <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{link.description}</p>}<span className="mt-1 inline-flex items-center gap-1 text-xs font-bold">{PLATFORM_META[link.platform].action} <ExternalLink size={12} /></span></div></a>
}

function CommunityPopup({ link, onClose }: { link: CommunityLink; onClose: () => void }) {
  const meta = PLATFORM_META[link.platform]
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-900/45 p-4 sm:items-center"><div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-brand-100 bg-surface shadow-[0_24px_80px_rgba(15,23,42,0.22)]"><button type="button" onClick={onClose} aria-label="বন্ধ করুন" className="absolute right-3 top-3 z-10 rounded-full bg-white/95 p-2 text-ink-600 shadow-sm hover:text-ink-900"><X size={18} /></button><div className={`bg-gradient-to-br ${meta.gradient} px-6 pb-8 pt-7 text-white`}><div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${meta.iconClass}`}><PlatformLogo platform={link.platform} size={31} /></div><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-white/75">{meta.label}</p><h2 className="mt-1 text-2xl font-extrabold">{link.title}</h2><p className="mt-2 text-sm leading-6 text-white/85">{link.description || 'সেলারদের জন্য আপডেট, সহায়তা ও গুরুত্বপূর্ণ ঘোষণা এক জায়গায়।'}</p></div><div className="p-5"><a href={link.url} target="_blank" rel="noreferrer" onClick={onClose} className={`flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${meta.gradient} px-4 py-3 font-extrabold text-white hover:brightness-95`}>{meta.action} <ExternalLink size={17} /></a><button type="button" onClick={onClose} className="mt-3 w-full rounded-xl border border-outline px-4 py-3 text-sm font-bold text-ink-600">পরে দেখব</button></div></div></div>
}
