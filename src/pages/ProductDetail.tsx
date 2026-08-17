import { useEffect, useRef, useState } from 'react'
import { Bell, Flag, MessageCircleQuestion, UserPlus } from 'lucide-react'
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
import { askProductQuestion, listProductQuestions, reportProduct, toggleProductAlert, toggleSellerFollow, type ProductQuestion } from '@/lib/publicFeatures'
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
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [alertEnabled, setAlertEnabled] = useState(false)
  const [followingSeller, setFollowingSeller] = useState(false)
  const [questions, setQuestions] = useState<ProductQuestion[]>([])
  const [questionText, setQuestionText] = useState('')
  const [featureMessage, setFeatureMessage] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('ভুল বা বিভ্রান্তিকর তথ্য')
  const [reportDetails, setReportDetails] = useState('')
  const touchStartX = useRef<number | null>(null)

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

  useEffect(() => {
    if (!id) return
    listProductQuestions(id).then(setQuestions).catch(() => setQuestions([]))
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

  const handleShare = async () => {
    const url = window.location.href
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
    const text = encodeURIComponent(`${product.title} — ${formatTaka(product.price)}\n${window.location.href}`)
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
    try { setAlertEnabled(await toggleProductAlert(user.uid, product.id, type)); setFeatureMessage(type === 'PRICE_DROP' ? 'দাম কমলে আপনাকে জানানো হবে।' : 'পণ্য আবার available হলে আপনাকে জানানো হবে।') } catch { setFeatureMessage('Alert চালু করা যায়নি — 016 migration run করা হয়েছে কি না দেখুন।') }
  }

  const handleFollow = async () => {
    if (!user) { navigate('/login'); return }
    try { setFollowingSeller(await toggleSellerFollow(user.uid, product.seller_id)); setFeatureMessage(followingSeller ? 'Seller follow বন্ধ হয়েছে।' : 'Seller follow করা হয়েছে।') } catch { setFeatureMessage('Seller follow চালু করা যায়নি।') }
  }

  const handleAsk = async () => {
    if (!user) { navigate('/login'); return }
    if (!questionText.trim()) return
    try { await askProductQuestion(user.uid, product.id, questionText.trim()); setQuestionText(''); setFeatureMessage('আপনার প্রশ্ন জমা হয়েছে। Seller উত্তর দিলে এখানে দেখা যাবে।'); setQuestions(await listProductQuestions(product.id)) } catch { setFeatureMessage('প্রশ্ন জমা দেওয়া যায়নি।') }
  }

  const handleReport = async () => {
    if (!user) { navigate('/login'); return }
    try { await reportProduct(user.uid, product.id, reportReason, reportDetails); setShowReport(false); setReportDetails(''); setFeatureMessage('Report জমা হয়েছে। আমাদের team review করবে।') } catch { setFeatureMessage('Report জমা দেওয়া যায়নি।') }
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
              if (Math.abs(deltaX) < SWIPE_THRESHOLD || product.images.length < 2) return
              setActiveImage((i) => {
                if (deltaX < 0) return (i + 1) % product.images.length // swipe left -> next
                return (i - 1 + product.images.length) % product.images.length // swipe right -> prev
              })
            }}
          >
            {product.images[activeImage] ? (
              <img
                src={product.images[activeImage]}
                alt={product.title}
                className="h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-ink-300">ছবি নেই</div>
            )}
            {product.images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                {product.images.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${i === activeImage ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
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
            <button
              onClick={() => handleAlert(product.is_digital ? 'PRICE_DROP' : 'BACK_IN_STOCK')}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium ${alertEnabled ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline text-ink-600 hover:border-brand-500 hover:text-brand-600'}`}
            >
              <Bell size={14} />{alertEnabled ? 'Alert চালু আছে' : product.is_digital ? 'দাম কমলে জানাবেন' : 'স্টক এলে জানাবেন'}
            </button>
            <button onClick={() => setShowReport(true)} className="inline-flex items-center gap-1.5 rounded-full border border-outline px-3 py-1.5 font-medium text-ink-600 hover:border-error hover:text-error"><Flag size={14} />Report</button>
            <button
              onClick={handleShare}
              className="rounded-full border border-outline px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600"
            >
              শেয়ার / লিংক কপি
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="rounded-full border border-outline px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-brand-500 hover:text-brand-600"
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
          {seller && <button onClick={handleFollow} className={`mt-2 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${followingSeller ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline text-ink-600 hover:border-brand-500 hover:text-brand-600'}`}><UserPlus size={16} />{followingSeller ? 'Seller follow করা আছে' : 'Seller follow করুন'}</button>}

          <section className="mt-6 rounded-2xl border border-outline bg-surface p-4">
            <div className="flex items-center gap-2"><MessageCircleQuestion size={19} className="text-brand-600" /><h2 className="font-semibold text-ink-900">প্রশ্ন ও উত্তর</h2></div>
            <div className="mt-3 space-y-3">{questions.length === 0 ? <p className="text-sm text-ink-500">এখনো কোনো প্রশ্ন নেই। প্রথম প্রশ্নটি করুন।</p> : questions.map((question) => <div key={question.id} className="rounded-xl bg-bg p-3"><p className="text-sm font-medium text-ink-800">প্রশ্ন: {question.question}</p>{question.answer && <p className="mt-2 text-sm text-ink-600">উত্তর: {question.answer}</p>}</div>)}</div>
            {user ? <div className="mt-3 flex gap-2"><input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="এই পণ্য সম্পর্কে প্রশ্ন করুন..." className="min-w-0 flex-1 rounded-xl border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><button onClick={handleAsk} className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">জিজ্ঞাসা</button></div> : <Link to="/login" className="mt-3 inline-block text-sm font-semibold text-brand-600">প্রশ্ন করতে লগইন করুন</Link>}
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

      {showBuy && user && <BuyModal product={product} buyerId={user.uid} onClose={() => setShowBuy(false)} />}
      {showReport && <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 sm:items-center sm:p-5"><div className="w-full max-w-md rounded-t-3xl bg-surface p-5 sm:rounded-3xl"><h2 className="text-lg font-bold text-ink-900">Listing report করুন</h2><p className="mt-1 text-sm text-ink-500">কেন listing-টি সমস্যা মনে হচ্ছে?</p><select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="mt-4 w-full rounded-xl border border-outline px-3 py-2.5 text-sm"><option>ভুল বা বিভ্রান্তিকর তথ্য</option><option>নিষিদ্ধ পণ্য</option><option>ভুয়া বা প্রতারণামূলক listing</option><option>অন্য কারণ</option></select><textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} rows={4} placeholder="বিস্তারিত লিখুন (ঐচ্ছিক)" className="mt-3 w-full rounded-xl border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><div className="mt-4 flex gap-2"><button onClick={() => setShowReport(false)} className="flex-1 rounded-xl border border-outline py-2.5 text-sm font-semibold text-ink-600">বাতিল</button><button onClick={handleReport} className="flex-1 rounded-xl bg-error py-2.5 text-sm font-semibold text-white">Report পাঠান</button></div></div></div>}
    </Layout>
  )
}
