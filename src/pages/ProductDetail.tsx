import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { BuyModal } from '@/components/BuyModal'
import { RecommendedProducts } from '@/components/RecommendedProducts'
import { findOrCreateThread } from '@/lib/chat'
import { isFavorited, addFavorite, removeFavorite } from '@/lib/favorites'
import { trackProductView } from '@/lib/recentlyViewed'
import { formatTaka, formatDate } from '@/lib/format'
import type { Product, Profile } from '@/types/product'

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [product, setProduct] = useState<Product | null>(null)
  const [seller, setSeller] = useState<Profile | null>(null)
  const [activeImage, setActiveImage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showBuy, setShowBuy] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [togglingFavorite, setTogglingFavorite] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)

    async function load() {
      const { data: productData } = await supabase.from('products').select('*').eq('id', id).single()
      setProduct(productData)

      if (productData) {
        const { data: sellerData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', productData.seller_id)
          .maybeSingle()
        setSeller(sellerData)

        trackProductView(productData.id)

        // best-effort view count bump — not critical if it fails silently
        supabase
          .from('products')
          .update({ view_count: productData.view_count + 1 })
          .eq('id', id)
          .then(() => {})
      }
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!user || !id) return
    isFavorited(user.uid, id).then(setFavorited)
  }, [user, id])

  if (loading) {
    return (
      <Layout wide>
        <div className="h-96 animate-pulse rounded-2xl bg-outline/40" />
      </Layout>
    )
  }

  if (!product) {
    return (
      <Layout wide>
        <p className="py-16 text-center text-ink-600">পণ্যটি পাওয়া যায়নি — হয়তো সরিয়ে ফেলা হয়েছে।</p>
      </Layout>
    )
  }

  const isOwnListing = user?.uid === product.seller_id

  const handleChat = async () => {
    if (!user) return
    setStartingChat(true)
    try {
      const threadId = await findOrCreateThread(user.uid, product.seller_id, product.id)
      navigate(`/chat/${threadId}`)
    } finally {
      setStartingChat(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!user || togglingFavorite) return
    setTogglingFavorite(true)
    const next = !favorited
    setFavorited(next)
    try {
      if (next) await addFavorite(user.uid, product.id)
      else await removeFavorite(user.uid, product.id)
    } catch {
      setFavorited(!next)
    } finally {
      setTogglingFavorite(false)
    }
  }

  return (
    <Layout wide>
      <Helmet>
        <title>{`${product.title} — ৳${product.price} | BikriKoro.Com`}</title>
        <meta
          name="description"
          content={`${product.title} — ${formatTaka(product.price)} টাকায় ${product.location}-এ। ${(product.description || '').slice(0, 120)}`}
        />
        <link rel="canonical" href={`https://bikrikoro.com/products/${product.id}`} />
        <meta property="og:type" content="product" />
        <meta property="og:title" content={product.title} />
        <meta property="og:description" content={(product.description || '').slice(0, 200)} />
        {product.images[0] && <meta property="og:image" content={product.images[0]} />}
        <meta property="og:url" content={`https://bikrikoro.com/products/${product.id}`} />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.title,
            description: product.description || product.title,
            image: product.images,
            offers: {
              '@type': 'Offer',
              price: product.price,
              priceCurrency: 'BDT',
              availability: 'https://schema.org/InStock',
              url: `https://bikrikoro.com/products/${product.id}`,
            },
            itemCondition:
              product.condition === 'NEW' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
          })}
        </script>
      </Helmet>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl bg-outline/30">
            {product.images[activeImage] ? (
              <img
                src={product.images[activeImage]}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ink-300">ছবি নেই</div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {product.images.map((img, i) => (
                <button
                  key={img}
                  onClick={() => setActiveImage(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                    i === activeImage ? 'border-brand-500' : 'border-transparent'
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            {product.is_escrow_protected ? (
              <span className="inline-block rounded-md bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700">
                এসক্রো সুরক্ষিত
              </span>
            ) : (
              <span />
            )}
            {user && (
              <button
                onClick={handleToggleFavorite}
                disabled={togglingFavorite}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-outline text-lg hover:border-error"
                aria-label={favorited ? 'পছন্দের তালিকা থেকে সরান' : 'পছন্দের তালিকায় যোগ করুন'}
              >
                <span className={favorited ? 'text-error' : 'text-ink-300'}>{favorited ? '♥' : '♡'}</span>
              </button>
            )}
          </div>
          <h1 className="mt-2 text-xl font-semibold text-ink-900 sm:text-2xl">{product.title}</h1>

          <div className="mt-3 flex items-baseline gap-3">
            <span className="tabular-amount text-2xl font-bold text-brand-600">
              {formatTaka(product.price)}
            </span>
            {product.original_price && product.original_price > product.price && (
              <span className="tabular-amount text-base text-ink-300 line-through">
                {formatTaka(product.original_price)}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-bg px-3 py-1 text-ink-600">
              {product.condition === 'NEW' ? 'নতুন' : 'ব্যবহৃত'}
            </span>
            <span className="rounded-full bg-bg px-3 py-1 text-ink-600">{product.location}</span>
            <span className="rounded-full bg-bg px-3 py-1 text-ink-600">
              পোস্ট করা হয়েছে {formatDate(product.created_at)}
            </span>
          </div>

          <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-ink-600">
            {product.description || 'কোনো বিবরণ দেওয়া হয়নি।'}
          </p>

          {seller && (
            <Link
              to={`/sellers/${seller.id}`}
              className="mt-6 flex items-center gap-3 rounded-xl border border-outline p-4 hover:border-brand-500/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
                {seller.name.charAt(0) || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium text-ink-900">{seller.name || 'বিক্রেতা'}</p>
                  {seller.is_verified && (
                    <span className="text-xs text-info" title="যাচাইকৃত বিক্রেতা">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-300">
                  {seller.review_count > 0
                    ? `★ ${seller.rating} (${seller.review_count} রিভিউ)`
                    : 'এখনো কোনো রিভিউ নেই'}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-brand-600">প্রোফাইল দেখুন →</span>
            </Link>
          )}

          <div className="mt-6 space-y-2">
            {isOwnListing ? (
              <Link
                to={`/sell/${product.id}`}
                className="block w-full rounded-xl border border-brand-500 py-3 text-center text-sm font-semibold text-brand-600 hover:bg-brand-50"
              >
                লিস্টিং এডিট করুন
              </Link>
            ) : user ? (
              <>
                <button
                  onClick={() => setShowBuy(true)}
                  className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600"
                >
                  অর্ডার করুন
                </button>
                <button
                  onClick={handleChat}
                  disabled={startingChat}
                  className="w-full rounded-xl border border-outline py-3 text-sm font-semibold text-ink-600 hover:border-brand-500 hover:text-brand-600 disabled:opacity-50"
                >
                  {startingChat ? 'অপেক্ষা করুন...' : 'বিক্রেতার সাথে চ্যাট করুন'}
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="block w-full rounded-xl bg-brand-500 py-3 text-center text-sm font-semibold text-white hover:bg-brand-600"
              >
                অর্ডার করতে লগইন করুন
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Category-based, not location-based — BikriKoro is a virtual/digital-first
          marketplace, not a hyper-local pickup app, so "similar item" beats
          "item near you" as the recommendation signal here. */}
      <RecommendedProducts
        title="সম্পর্কিত পণ্য"
        mode={{ type: 'related', categoryId: product.category_id, excludeProductId: product.id }}
      />

      {showBuy && user && (
        <BuyModal product={product} buyerId={user.uid} onClose={() => setShowBuy(false)} />
      )}
    </Layout>
  )
}
