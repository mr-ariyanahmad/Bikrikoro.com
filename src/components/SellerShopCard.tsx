import { ChevronRight, Heart, Package, Star, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Profile } from '@/types/product'
import { shopUrl } from '@/lib/shopProfile'
import { BikrifyBadge } from '@/components/BikrifyBadge'

export function SellerShopCard({ seller, followerCount, productCount, onFollow, following, badges: _badges = [] }: {
  seller: Profile
  followerCount: number
  productCount: number
  onFollow: () => void
  following: boolean
  badges?: Array<{ badge_key: string; badge_label: string }>
}) {
  const shopName = seller.shop_name?.trim() || seller.name || 'বিক্রেতা'
  const profileUrl = shopUrl(seller.shop_username, seller.id)
  return (
    <section className="rounded-2xl border border-outline bg-surface shadow-sm">
      <div className="flex items-center gap-2.5 px-3 py-3 sm:gap-3 sm:px-4 sm:py-3.5">
        <Link to={profileUrl} className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-100 bg-brand-100 text-lg font-bold text-brand-700 transition hover:border-brand-500 sm:h-16 sm:w-16">
          {seller.photo_url ? <img src={seller.photo_url} alt={`${shopName} shop`} className="h-full w-full object-cover" loading="lazy" /> : shopName.charAt(0)}
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={profileUrl} className="block transition hover:text-brand-700">
            <div className="flex flex-wrap items-center gap-1"><h2 className="truncate text-sm font-bold text-ink-900 sm:text-base">{shopName}</h2>{seller.is_verified && <BikrifyBadge compact />}</div>
            {seller.name && seller.name !== shopName && <p className="mt-0.5 truncate text-xs text-ink-500">{seller.name}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-ink-600"><span className="inline-flex items-center gap-0.5"><Star size={12} className="fill-amber-400 text-amber-400" />{seller.review_count > 0 ? seller.rating.toFixed(1) : '—'}</span><span className="inline-flex items-center gap-0.5"><Package size={12} />{productCount}টি পণ্য</span><span className="inline-flex items-center gap-0.5"><Users size={12} />{followerCount} জন অনুসরণ</span></div>
            {seller.is_verified && <div className="mt-1.5"><BikrifyBadge compact /></div>}
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={onFollow} className={`inline-flex h-9 w-24 items-center justify-center gap-1 rounded-full border px-2 text-[11px] font-semibold whitespace-nowrap transition sm:h-10 sm:w-36 sm:gap-1.5 sm:text-xs ${following ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-brand-500 text-brand-700 hover:bg-brand-50'}`}><Heart size={14} className={following ? 'fill-brand-500 text-brand-500' : ''} /><span>{following ? 'অনুসরণ করা আছে' : 'অনুসরণ'}</span></button><Link to={profileUrl} aria-label="সেলার প্রোফাইল দেখুন" className="grid h-9 w-8 place-items-center text-ink-400 hover:text-brand-700 sm:h-10"><ChevronRight size={20} /></Link></div>
      </div>
    </section>
  )
}
