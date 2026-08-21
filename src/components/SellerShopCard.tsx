import { BadgeCheck, Heart, Package, Star, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Profile } from '@/types/product'
import { shopUrl } from '@/lib/shopProfile'

export function SellerShopCard({ seller, followerCount, productCount, onFollow, following, badges = [] }: {
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
    <section className="overflow-hidden border border-outline bg-surface shadow-sm">
      <Link to={profileUrl} className="block transition hover:bg-brand-50/30">
        <div className="relative h-20 overflow-hidden bg-gradient-to-r from-brand-800 via-brand-600 to-emerald-300">
          {seller.shop_cover_url ? <img src={seller.shop_cover_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 0, transparent 28%), radial-gradient(circle at 85% 45%, white 0, transparent 24%)' }} />}
        </div>
        <div className="relative flex items-center gap-3 px-4 pb-4 pt-0 sm:px-5">
          <div className="-mt-8 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border-4 border-white bg-brand-100 text-xl font-bold text-brand-700 shadow-sm">
            {seller.photo_url ? <img src={seller.photo_url} alt={`${shopName} shop`} className="h-full w-full object-cover" loading="lazy" /> : shopName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1 pt-3">
            <div className="flex flex-wrap items-center gap-1.5"><h2 className="truncate text-base font-bold text-ink-900">{shopName}</h2>{seller.is_verified && <span className="inline-flex items-center gap-1 bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-700"><BadgeCheck size={13} />যাচাইকৃত</span>}</div>
            {seller.name && seller.name !== shopName && <p className="mt-0.5 truncate text-xs text-ink-500">{seller.name}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600"><span className="inline-flex items-center gap-1"><Star size={13} className="fill-amber-400 text-amber-400" />{seller.review_count > 0 ? seller.rating.toFixed(1) : '—'}</span><span className="inline-flex items-center gap-1"><Package size={13} />{productCount}টি পণ্য</span><span className="inline-flex items-center gap-1"><Users size={13} />{followerCount} জন অনুসরণ</span></div>
            {badges.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{badges.slice(0, 2).map((badge) => <span key={badge.badge_key} className="inline-flex items-center gap-1 bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700"><BadgeCheck size={12} />{badge.badge_label}</span>)}</div>}
          </div>
        </div>
      </Link>
      <div className="border-t border-outline px-4 py-3 sm:px-5"><button type="button" onClick={onFollow} className={`inline-flex items-center justify-center gap-2 border px-4 py-2.5 text-base font-semibold transition ${following ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-brand-500 text-brand-700 hover:bg-brand-50'}`}><Heart size={16} className={following ? 'fill-brand-500 text-brand-500' : ''} />{following ? 'অনুসরণ করা আছে' : 'শপ অনুসরণ করুন'}</button></div>
    </section>
  )
}
