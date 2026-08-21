import { useEffect, useRef, useState } from 'react'
import { Bell, Flag, MessageCircleQuestion, Play } from 'lucide-react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { BuyModal } from '@/components/BuyModal'
import { RecommendedProducts } from '@/components/RecommendedProducts'
import { SellerShopCard } from '@/components/SellerShopCard'
import { BrandSelect } from '@/components/BrandSelect'
import { findOrCreateThread } from '@/lib/chat'
import { isFavorited, addFavorite, removeFavorite } from '@/lib/favorites'
import { trackProductView } from '@/lib/recentlyViewed'
import { answerProductQuestion, askProductQuestion, getUserFeatureStatus, listProductQuestions, reportProduct, toggleProductAlert, toggleSellerFollow, type ProductQuestion } from '@/lib/publicFeatures'
import { formatTaka, formatDate } from '@/lib/format'
import type { Product, ProductDigitalSpecs, Profile } from '@/types/product'
import { getYouTubeEmbedUrl, getYouTubeVideoId } from '@/lib/youtube'
import { SITE_URL } from '@/lib/site'
import { PUBLIC_PRODUCT_FIELDS, PUBLIC_PRODUCT_TABLE } from '@/lib/publicProductFields'

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [product, setProduct] = useState<Product | null>(null)
  const [digitalSpecs, setDigitalSpecs] = useState<ProductDigitalSpecs | null>(null)
  const [seller, setSeller] = useState<Profile | null>(null)
  const [sellerBadges, setSellerBadges] = useState<Array<{ badge_key: string; badge_label: string }>>([])
  const [sellerStats, setSellerStats] = useState({ followerCount: 0, productCount: 0 })
  const [activeMedia, setActiveMedia] = useState(0)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showBuy, setShowBuy] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [togglingFavorite, setTogglingFavorite] = useState(false)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [alertEnabled, setAlertEnabled] = useState(false)
  const [followingSeller, setFollowingSeller] = useState(false)
  const [questions, setQuestions] = useState<ProductQuestion[]>([])
  const [questionText, setQuestionText] = useState('')
  const [replyTextByQuestion, setReplyTextByQuestion] = useState<Record<string, string>>({})
  const [replySavingId, setReplySavingId] = useState<string | null>(null)
  const [featureMessage, setFeatureMessage] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('ভুল বা বিভ্রান্তিকর তথ্য')
  const [reportDetails, setReportDetails] = useState('')
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setLoadError(null)
    setProduct(null)
    setDigitalSpecs(null)
    setSeller(null)
    setSellerBadges([])
    setActiveMedia(0)
    setVideoPlaying(false)

    async function load() {
      try {
        const { data: productData, error: productError } = await supabase.from(PUBLIC_PRODUCT_TABLE).select(PUBLIC_PRODUCT_FIELDS).eq('id', id).maybeSingle()
        if (productError) throw productError
        if (!active) return
        setProduct(productData as Product | null)

        if (productData?.is_digital) {
          const { data: specsData, error: specsError } = await supabase
            .from('product_digital_specs')
            .select('product_id, specifications, auto_delivery_enabled, deactivate_when_out_of_stock, stock_mode, stock_quantity, fulfillment_window_minutes, region_code, subscription_period, warranty_period, delivery_note, updated_at')
            .eq('product_id', id)
            .maybeSingle()
          if (specsError && !/relation .* does not exist/i.test(specsError.message)) console.error('Digital specs load failed:', specsError)
          if (specsData && active) setDigitalSpecs(specsData as ProductDigitalSpecs)
        }

        if (productData) {
          const { data: sellerData } = await supabase
            .from('profiles')
            .select('id, name, photo_url, shop_name, shop_description, shop_username, shop_cover_url, is_verified, rating, review_count, created_at')
            .eq('id', productData.seller_id)
            .maybeSingle()
          if (!active) return
          setSeller(sellerData as Profile | null)
          const { data: sellerPublicData } = await supabase.rpc('get_public_seller_profile', { p_lookup: productData.seller_id })
          const sellerPublic = Array.isArray(sellerPublicData) ? sellerPublicData[0] : sellerPublicData
          if (active) setSellerStats({ followerCount: Number(sellerPublic?.follower_count ?? 0), productCount: Number(sellerPublic?.product_count ?? 0) })
          supabase.from('seller_verification_badges').select('badge_key, badge_label').eq('user_id', productData.seller_id).order('verified_at', { ascending: false }).then(({ data: badgeData }) => {
            if (active) setSellerBadges((badgeData ?? []) as Array<{ badge_key: string; badge_label: string }>)
          })
          void trackProductView(productData.id)
        }
      } catch (error) {
        console.error('Product detail load failed:', error)
        if (active) setLoadError(error instanceof Error ? error.message : 'পণ্যটি লোড করা যায়নি।')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!user || !id || !product) {
      setFavorited(false)
      setAlertEnabled(false)
      setFollowingSeller(false)
      return
    }
    let active = true
    Promise.all([
      isFavorited(user.uid, id),
      getUserFeatureStatus(id, product.seller_id, product.is_digital ? 'PRICE_DROP' : 'BACK_IN_STOCK'),
    ]).then(([favorite, featureStatus]) => {
      if (!active) return
      setFavorited(favorite)
      setAlertEnabled(featureStatus.alertEnabled)
      setFollowingSeller(featureStatus.following)
    }).catch((error) => console.error('Product preference load failed:', error))
    return () => { active = false }
  }, [user, id, product])

  useEffect(() => {
    if (!id) return
    listProductQuestions(id).then(setQuestions).catch((error) => {
      console.error('Product questions load failed:', error)
      setQuestions([])
      setFeatureMessage(error instanceof Error ? error.message : 'প্রশ্নগুলো লোড করা যায়নি।')
    })
  }, [id])

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
        <div className="py-16 text-center"><p className="text-ink-600">{loadError ? `পণ্যটি লোড করা যায়নি: ${loadError}` : 'পণ্যটি পাওয়া যায়নি — হয়তো সরিয়ে ফেলা হয়েছে।'}</p><Link to="/products" className="mt-4 inline-flex border border-brand-500 px-4 py-2.5 text-sm font-semibold text-brand-700">সব পণ্য দেখুন</Link></div>
      </Layout>
    )
  }

  const isOwnListing = user?.uid === product.seller_id
  const videoEmbedUrl = getYouTubeEmbedUrl(product.video_url)
  const videoId = getYouTubeVideoId(product.video_url)
  const mediaCount = product.images.length + (videoEmbedUrl ? 1 : 0)
  const activeImageIndex = activeMedia - (videoEmbedUrl ? 1 : 0)

  const handleChat = async () => {
    if (!user) { navigate('/login'); return }
    setStartingChat(true)
    setFeatureMessage(null)
    try {
      const threadId = await findOrCreateThread(product.seller_id, product.id)
      navigate(`/chat/${threadId}`)
    } catch (error) {
      console.error('seller chat start failed:', error)
      setFeatureMessage(error instanceof Error ? `চ্যাট খোলা যায়নি: ${error.message}` : 'চ্যাট খোলা যায়নি।')
    } finally {
      setStartingChat(false)
    }
  }

  const getShareUrl = () => `${SITE_URL}/api/product-preview?id=${encodeURIComponent(product.id)}`

  const handleShare = async () => {
    const url = getShareUrl()
    try {
      if (navigator.share) {
        await navigator.share({ title: product.title, text: `${product.title} — ${formatTaka(product.price)}`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareMessage('লিংক কপি হয়েছে।')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setShareMessage('লিংক কপি করা যায়নি।')
    }
    window.setTimeout(() => setShareMessage(null), 2500)
  }

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`${product.title} — ${formatTaka(product.price)}\n${getShareUrl()}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
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

  const handleAlert = async (type: 'PRICE_DROP' | 'BACK_IN_STOCK') => {
    if (!user) { navigate('/login'); return }
    try {
      const enabled = await toggleProductAlert(product.id, type)
      setAlertEnabled(enabled)
      setFeatureMessage(enabled ? (type === 'PRICE_DROP' ? 'দাম কমলে আপনাকে জানানো হবে।' : 'পণ্য আবার পাওয়া গেলে আপনাকে জানানো হবে।') : 'এই পণ্যের সতর্কতা বন্ধ হয়েছে।')
    } catch (error) {
      setFeatureMessage(error instanceof Error ? `সতর্কতা চালু করা যায়নি: ${error.message}` : 'সতর্কতা চালু করা যায়নি।')
    }
  }

  const handleFollow = async () => {
    if (!user) { navigate('/login'); return }
    try {
      const nextFollowing = await toggleSellerFollow(product.seller_id)
      setFollowingSeller(nextFollowing)
      setSellerStats((current) => ({ ...current, followerCount: Math.max(0, current.followerCount + (nextFollowing ? 1 : -1)) }))
      setFeatureMessage(nextFollowing ? 'বিক্রেতাকে অনুসরণ করা হয়েছে।' : 'বিক্রেতাকে অনুসরণ বন্ধ হয়েছে।')
    } catch (error) {
      setFeatureMessage(error instanceof Error ? `বিক্রেতাকে অনুসরণ চালু করা যায়নি: ${error.message}` : 'বিক্রেতাকে অনুসরণ চালু করা যায়নি।')
    }
  }

  const handleAsk = async () => {
    if (!user) { navigate('/login'); return }
    if (!questionText.trim()) return
    try {
      await askProductQuestion(product.id, questionText.trim())
      setQuestionText('')
      setFeatureMessage('আপনার প্রশ্ন জমা হয়েছে। বিক্রেতা উত্তর দিলে এখানে দেখা যাবে।')
      setQuestions(await listProductQuestions(product.id))
    } catch (error) {
      setFeatureMessage(error instanceof Error ? `প্রশ্ন জমা দেওয়া যায়নি: ${error.message}` : 'প্রশ্ন জমা দেওয়া যায়নি।')
    }
  }

  const handleReply = async (questionId: string) => {
    if (!isOwnListing) return
    const answer = replyTextByQuestion[questionId]?.trim() || ''
    if (!answer || replySavingId) return
    setReplySavingId(questionId)
    setFeatureMessage(null)
    try {
      await answerProductQuestion(questionId, answer)
      setReplyTextByQuestion((current) => ({ ...current, [questionId]: '' }))
      setQuestions(await listProductQuestions(product.id))
      setFeatureMessage('আপনার উত্তর প্রকাশ হয়েছে।')
    } catch (error) {
      setFeatureMessage(error instanceof Error ? `উত্তর সংরক্ষণ করা যায়নি: ${error.message}` : 'উত্তর সংরক্ষণ করা যায়নি।')
    } finally {
      setReplySavingId(null)
    }
  }

  const handleReport = async () => {
    if (!user) { navigate('/login'); return }
    try {
      await reportProduct(product.id, reportReason, reportDetails)
      setShowReport(false)
      setReportDetails('')
      setFeatureMessage('অভিযোগ জমা হয়েছে। আমাদের দল এটি পর্যালোচনা করবে।')
    } catch (error) {
      setFeatureMessage(error instanceof Error ? `অভিযোগ জমা দেওয়া যায়নি: ${error.message}` : 'অভিযোগ জমা দেওয়া যায়নি।')
    }
  }

  return (
    <Layout wide hideFooter={showBuy}>
      <Helmet>
        <title>{`${product.title} — ৳${product.price} | BikriKoro.Com`}</title>
        <meta
          name="description"
          content={`${product.title} — ${formatTaka(product.price)} টাকায় ${product.location}-এ। ${(product.description || '').slice(0, 120)}`}
        />
        <link rel="canonical" href={`${SITE_URL}/products/${product.id}`} />
        <meta property="og:type" content="product" />
        <meta property="og:title" content={product.title} />
        <meta property="og:description" content={(product.description || '').slice(0, 200)} />
        {product.images[0] && <meta property="og:image" content={product.images[0]} />}
        {videoEmbedUrl && <meta property="og:video" content={videoEmbedUrl} />}
        <meta property="og:url" content={`${SITE_URL}/products/${product.id}`} />
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
              url: `${SITE_URL}/products/${product.id}`,
            },
            itemCondition:
              product.condition === 'NEW' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
            video: videoEmbedUrl ? {
              '@type': 'VideoObject',
              embedUrl: videoEmbedUrl,
              name: `${product.title} পণ্যের ভিডিও`,
              description: product.description || product.title,
            } : undefined,
          })}
        </script>
      </Helmet>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div
            className="relative aspect-square touch-pan-y overflow-hidden rounded-2xl bg-outline/30"
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0].clientX
            }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return
              const deltaX = e.changedTouches[0].clientX - touchStartX.current
              touchStartX.current = null
              const SWIPE_THRESHOLD = 40
              if (Math.abs(deltaX) < SWIPE_THRESHOLD || mediaCount < 2) return
              setActiveMedia((i) => {
                if (deltaX < 0) return (i + 1) % mediaCount // swipe left -> next
                return (i - 1 + mediaCount) % mediaCount // swipe right -> prev
              })
            }}
          >
            {videoEmbedUrl && activeMedia === 0 ? (
              videoPlaying ? <iframe
                src={videoEmbedUrl}
                title={`${product.title} পণ্যের ভিডিও`}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              /> : <button type="button" onClick={() => setVideoPlaying(true)} className="relative h-full w-full overflow-hidden bg-ink-900 text-left">
                {videoId && <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt={`${product.title} video preview`} className="h-full w-full object-cover opacity-80" />}
                <span className="absolute inset-0 flex items-center justify-center"><span className="inline-flex items-center gap-2 bg-brand-500 px-4 py-3 text-base font-semibold text-white"><Play size={19} fill="currentColor" />ভিডিও চালু করুন</span></span>
              </button>
            ) : product.images[activeImageIndex] ? (
              <img
                src={product.images[activeImageIndex]}
                alt={product.title}
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ink-300">ছবি নেই</div>
            )}
            {mediaCount > 1 && (
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {Array.from({ length: mediaCount }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${i === activeMedia ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            )}
          </div>
          {mediaCount > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {videoEmbedUrl && <button type="button" onClick={() => { setActiveMedia(0); setVideoPlaying(false) }} className={`flex h-16 w-24 shrink-0 items-center justify-center gap-1 border-2 bg-ink-900 text-xs font-semibold text-white ${activeMedia === 0 ? 'border-brand-500' : 'border-transparent'}`}><Play size={15} fill="currentColor" />ভিডিও</button>}
              {product.images.map((img, i) => {
                const mediaIndex = videoEmbedUrl ? i + 1 : i
                return <button type="button" key={img} onClick={() => { setActiveMedia(mediaIndex); setVideoPlaying(false) }} className={`h-16 w-16 shrink-0 overflow-hidden border-2 ${mediaIndex === activeMedia ? 'border-brand-500' : 'border-transparent'}`}><img src={img} alt="" className="h-full w-full object-cover" /></button>
              })}
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
                type="button"
                onClick={handleToggleFavorite}
                disabled={togglingFavorite}
                className="flex h-9 w-9 items-center justify-center rounded-none border border-outline text-lg hover:border-error"
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
            <button type="button" onClick={() => handleAlert(product.is_digital ? 'PRICE_DROP' : 'BACK_IN_STOCK')}
              className={`inline-flex items-center gap-1.5 rounded-none border px-3 py-1.5 font-medium ${alertEnabled ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline text-ink-600 hover:border-brand-500 hover:text-brand-600'}`}
            >
              <Bell size={14} />{alertEnabled ? 'সতর্কতা চালু আছে' : product.is_digital ? 'দাম কমলে জানাবেন' : 'স্টক এলে জানাবেন'}
            </button>
            <button type="button" onClick={() => setShowReport(true)} className="inline-flex items-center gap-1.5 rounded-none border border-outline px-3 py-1.5 font-medium text-ink-600 hover:border-error hover:text-error"><Flag size={14} />অভিযোগ</button>
            <button
              type="button"
              onClick={handleShare}
              className="rounded-none border border-outline px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600"
            >
              শেয়ার / লিংক কপি
            </button>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="rounded-none border border-outline px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600"
            >
              WhatsApp-এ পাঠান
            </button>
            {shareMessage && <span className="rounded-full bg-brand-50 px-3 py-1.5 text-brand-700">{shareMessage}</span>}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-bg px-3 py-1 text-ink-600">
              {product.condition === 'NEW' ? 'নতুন' : 'ব্যবহৃত'}
            </span>
            {product.is_digital ? (
              <span className="rounded-full bg-bg px-3 py-1 text-ink-600">ডিজিটাল পণ্য</span>
            ) : (
              product.location && (
                <span className="rounded-full bg-bg px-3 py-1 text-ink-600">{product.location}</span>
              )
            )}
            <span className="rounded-full bg-bg px-3 py-1 text-ink-600">
              পোস্ট করা হয়েছে {formatDate(product.created_at)}
            </span>
          </div>

          <h2 className="mt-5 text-sm font-semibold text-ink-900">বিবরণ</h2>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-600">
            {product.description || 'কোনো বিবরণ দেওয়া হয়নি।'}
          </p>

          {product.is_digital && digitalSpecs && Object.keys(digitalSpecs.specifications ?? {}).length > 0 && <section className="mt-4 border border-outline bg-surface p-4"><h2 className="text-sm font-semibold text-ink-900">পণ্যের গুরুত্বপূর্ণ তথ্য</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{Object.entries(digitalSpecs.specifications).map(([key, value]) => <div key={key} className="border-b border-outline/70 pb-2"><p className="text-xs text-ink-400">{key.replaceAll('_', ' ')}</p><p className="mt-0.5 break-words text-sm font-medium text-ink-800">{typeof value === 'boolean' ? value ? 'হ্যাঁ' : 'না' : Array.isArray(value) ? value.join(', ') : String(value)}</p></div>)}</div><div className="mt-3 flex flex-wrap gap-2 text-xs text-ink-600"><span className="border border-outline px-2 py-1">অঞ্চল: {digitalSpecs.region_code}</span>{digitalSpecs.subscription_period && <span className="border border-outline px-2 py-1">মেয়াদ: {digitalSpecs.subscription_period}</span>}{digitalSpecs.warranty_period && <span className="border border-outline px-2 py-1">ওয়ারেন্টি: {digitalSpecs.warranty_period}</span>}{digitalSpecs.auto_delivery_enabled && <span className="border border-brand-200 bg-brand-50 px-2 py-1 text-brand-700">স্বয়ংক্রিয় ডেলিভারি</span>}</div>{digitalSpecs.delivery_note && <p className="mt-3 border-l-2 border-brand-500 pl-3 text-xs leading-5 text-ink-600">{digitalSpecs.delivery_note}</p>}</section>}

          <div className="mt-4 rounded-xl bg-bg p-4 text-xs leading-relaxed text-ink-600">
            <p className="font-medium text-ink-900">অর্ডার নীতি</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              <li>পেমেন্ট এসক্রোতে জমা থাকে — পণ্য হাতে পাওয়ার আগে বিক্রেতাকে দেওয়া হয় না।</li>
              <li>শুধুমাত্র বিকাশ/নগদ/রকেট দিয়ে আগে থেকে পেমেন্ট, কোনো ক্যাশ অন ডেলিভারি নেই।</li>
              <li>
                {product.is_digital
                  ? 'ডিজিটাল পণ্য — কুরিয়ারে পাঠানো হয় না, তাই কোনো ডেলিভারি ঠিকানা লাগবে না।'
                  : 'পণ্য না পেলে বা বিবরণের সাথে না মিললে অর্ডার পেজ থেকে অভিযোগ জানানো যাবে।'}
              </li>
            </ul>
          </div>

          {seller && <div className="mt-6"><SellerShopCard seller={seller} followerCount={sellerStats.followerCount} productCount={sellerStats.productCount} badges={sellerBadges} following={followingSeller} onFollow={() => void handleFollow()} /></div>}

          <section className="mt-6 rounded-2xl border border-outline bg-surface p-4">
            <div className="flex items-center gap-2"><MessageCircleQuestion size={19} className="text-brand-600" /><h2 className="font-semibold text-ink-900">প্রশ্ন ও উত্তর</h2></div>
            <div className="mt-3 space-y-3">{questions.length === 0 ? <p className="text-sm text-ink-500">এখনো কোনো প্রশ্ন নেই। প্রথম প্রশ্নটি করুন।</p> : questions.map((question) => <div key={question.id} className="rounded-xl bg-bg p-3"><p className="text-sm font-medium text-ink-800">প্রশ্ন: {question.question}</p>{question.answer && <div className="mt-2 rounded-lg border-l-2 border-brand-500 bg-surface px-3 py-2"><p className="text-xs font-semibold text-brand-700">বিক্রেতার উত্তর</p><p className="mt-1 text-sm text-ink-600">{question.answer}</p></div>}{isOwnListing && <div className="mt-3"><textarea value={replyTextByQuestion[question.id] ?? ''} onChange={(event) => setReplyTextByQuestion((current) => ({ ...current, [question.id]: event.target.value }))} rows={2} maxLength={2000} placeholder={question.answer ? 'উত্তর পরিবর্তন করুন...' : 'এই প্রশ্নের উত্তর লিখুন...'} className="w-full rounded-xl border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] text-ink-400">এই পণ্যের বিক্রেতাই উত্তর দিতে পারবেন।</span><button type="button" onClick={() => handleReply(question.id)} disabled={replySavingId === question.id || !(replyTextByQuestion[question.id] ?? '').trim()} className="rounded-none bg-brand-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{replySavingId === question.id ? 'সংরক্ষণ হচ্ছে...' : question.answer ? 'উত্তর আপডেট করুন' : 'উত্তর দিন'}</button></div></div>}</div>)}</div>
            {user ? <div className="mt-3 flex gap-2"><input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="এই পণ্য সম্পর্কে প্রশ্ন করুন..." className="min-w-0 flex-1 rounded-xl border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><button type="button" onClick={handleAsk} className="rounded-none bg-brand-500 px-3 py-2 text-sm font-semibold text-white">জিজ্ঞাসা</button></div> : <Link to="/login" className="mt-3 inline-block text-sm font-semibold text-brand-600">প্রশ্ন করতে লগইন করুন</Link>}
          </section>
          {featureMessage && <p className="mt-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">{featureMessage}</p>}

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
                  type="button"
                  onClick={() => setShowBuy(true)}
                  className="w-full rounded-none bg-brand-500 py-3 text-sm font-semibold text-white hover:bg-brand-600"
                >
                  অর্ডার করুন
                </button>
                <button
                  type="button"
                  onClick={handleChat}
                  disabled={startingChat}
                  className="w-full rounded-none border border-outline py-3 text-sm font-semibold text-ink-600 hover:border-brand-500 hover:text-brand-600 disabled:opacity-50"
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

      {/* Recommendations are intentionally separated by intent: seller trust,
          category relevance, then broader marketplace discovery. */}
      <RecommendedProducts
        title="এই সেলারের আরও পণ্য"
        mode={{ type: 'seller', sellerId: product.seller_id, excludeProductId: product.id }}
        limit={8}
      />
      <RecommendedProducts
        title="এই ক্যাটাগরির আরও পণ্য"
        mode={{ type: 'related', categoryId: product.category_id, excludeProductId: product.id }}
        limit={8}
      />
      <RecommendedProducts
        title="আপনার জন্য আরও পণ্য"
        mode={{ type: 'popular' }}
        limit={8}
      />

      {showBuy && user && <BuyModal product={product} digitalSpecs={digitalSpecs} buyerId={user.uid} onClose={() => setShowBuy(false)} />}
      {showReport && <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 sm:items-center sm:p-5"><div className="w-full max-w-md rounded-t-3xl bg-surface p-5 sm:rounded-3xl"><h2 className="text-lg font-bold text-ink-900">তালিকা সম্পর্কে অভিযোগ করুন</h2><p className="mt-1 text-sm text-ink-500">কেন তালিকাটি সমস্যাযুক্ত মনে হচ্ছে?</p><div className="mt-4"><BrandSelect label="অভিযোগের কারণ" value={reportReason} options={['ভুল বা বিভ্রান্তিকর তথ্য', 'নিষিদ্ধ পণ্য', 'ভুয়া বা প্রতারণামূলক তালিকা', 'অন্য কারণ'].map((value) => ({ value, label: value }))} onChange={setReportReason} /></div><textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} rows={4} placeholder="বিস্তারিত লিখুন (ঐচ্ছিক)" className="mt-3 w-full rounded-xl border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><div className="mt-4 flex gap-2"><button type="button" onClick={() => setShowReport(false)} className="flex-1 rounded-none border border-outline py-2.5 text-sm font-semibold text-ink-600">বাতিল</button><button type="button" onClick={handleReport} className="flex-1 rounded-none bg-error py-2.5 text-sm font-semibold text-white">অভিযোগ পাঠান</button></div></div></div>}
    </Layout>
  )
}
