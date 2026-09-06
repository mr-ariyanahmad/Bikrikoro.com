import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Globe2, MessageCircle, Send, Users, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Placement = 'HOME' | 'SEARCH' | 'SELLER_EDU' | 'SELLER_DASHBOARD'
export type CommunityLink = { id: string; platform: 'WHATSAPP' | 'FACEBOOK' | 'TELEGRAM' | 'OTHER'; title: string; description: string; url: string; image_url: string | null; placements: string[]; status: string; sort_order: number }

const ICONS = { WHATSAPP: MessageCircle, FACEBOOK: Globe2, TELEGRAM: Send, OTHER: ExternalLink }
const ACCENTS = { WHATSAPP: 'bg-[#e9f9ef] text-[#167943] border-[#b8e8c8]', FACEBOOK: 'bg-[#eef4ff] text-[#2558a8] border-[#c6d8ff]', TELEGRAM: 'bg-[#edf9ff] text-[#147ca5] border-[#bdeafa]', OTHER: 'bg-brand-50 text-brand-700 border-brand-100' }

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
  if (visible.length === 0) return popup && showPopup ? null : null
  return <>
    <section className={compact ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'}>
      {!compact && <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">BikriKoro কমিউনিটি</p><h2 className="mt-1 text-xl font-extrabold text-ink-900">আমাদের সাথে যুক্ত থাকুন</h2></div>}
      <div className={compact ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3 md:grid-cols-2'}>{visible.map((link) => <CommunityLinkCard key={link.id} link={link} compact={compact} />)}</div>
    </section>
    {showPopup && <CommunityPopup link={links.find((link) => link.platform === 'WHATSAPP') ?? links[0]} onClose={() => { window.sessionStorage.setItem('bikrikoro:seller-community-popup-dismissed', '1'); setShowPopup(false) }} />}
  </>
}

function CommunityLinkCard({ link, compact }: { link: CommunityLink; compact: boolean }) {
  const Icon = ICONS[link.platform] ?? ExternalLink
  const accent = ACCENTS[link.platform] ?? ACCENTS.OTHER
  return <a href={link.url} target="_blank" rel="noreferrer" className={`group flex items-center gap-3 rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] ${accent}`}><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/80">{link.image_url ? <img src={link.image_url} alt="" className="h-full w-full object-cover" /> : <Icon size={23} />}</div><div className="min-w-0 flex-1"><p className={`font-extrabold ${compact ? 'text-sm' : 'text-base'}`}>{link.title}</p>{!compact && link.description && <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{link.description}</p>}<span className="mt-1 inline-flex items-center gap-1 text-xs font-bold">Join / Open <ExternalLink size={12} /></span></div></a>
}

function CommunityPopup({ link, onClose }: { link: CommunityLink; onClose: () => void }) {
  const Icon = ICONS[link.platform] ?? Users
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-900/45 p-4 sm:items-center"><div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-brand-100 bg-surface shadow-[0_24px_80px_rgba(15,23,42,0.22)]"><button type="button" onClick={onClose} aria-label="বন্ধ করুন" className="absolute right-3 top-3 rounded-full bg-bg p-2 text-ink-600 hover:text-ink-900"><X size={18} /></button><div className="bg-gradient-to-br from-brand-500 to-brand-700 px-6 pb-8 pt-7 text-white"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15"><Icon size={28} /></div><p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-white/75">Seller community</p><h2 className="mt-1 text-2xl font-extrabold">{link.title}</h2><p className="mt-2 text-sm leading-6 text-white/85">{link.description || 'সেলারদের জন্য আপডেট, সহায়তা ও গুরুত্বপূর্ণ ঘোষণা এক জায়গায়।'}</p></div><div className="p-5"><a href={link.url} target="_blank" rel="noreferrer" onClick={onClose} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 font-extrabold text-white hover:bg-brand-600">গ্রুপে যোগ দিন <ExternalLink size={17} /></a><button type="button" onClick={onClose} className="mt-3 w-full rounded-xl border border-outline px-4 py-3 text-sm font-bold text-ink-600">পরে দেখব</button></div></div></div>
}
