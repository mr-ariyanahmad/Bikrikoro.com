import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { supabase } from '@/lib/supabase'
import { SITE_URL } from '@/lib/site'

type BlogPostData = { id: string; title: string; slug: string; excerpt: string; body: string; cover_image_url: string | null; seo_title: string | null; seo_description: string | null; published_at: string | null; updated_at: string }

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<BlogPostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setPost(null)
    setError(null)
    if (!slug) { setLoading(false); return () => { active = false } }
    const load = async () => {
      try {
        const { data, error: loadError } = await supabase.rpc('get_published_content', { p_content_type: 'BLOG', p_slug: slug })
        if (loadError) throw loadError
        if (!active) return
        setPost(((data ?? []) as BlogPostData[])[0] ?? null)
      } catch (loadError) {
        console.error('Blog post load failed:', loadError)
        if (active) setError(loadError instanceof Error ? loadError.message : 'ব্লগ পোস্ট লোড করা যায়নি।')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [slug])

  if (loading) return <Layout wide><div className="mx-auto h-96 max-w-3xl animate-pulse bg-outline/40" /></Layout>
  if (!post) return <Layout wide><div className="mx-auto max-w-3xl border border-outline bg-surface p-8 text-center"><BookOpen className="mx-auto text-brand-600" size={28} /><h1 className="mt-3 text-xl font-bold text-ink-900">{error ? 'ব্লগ লোড করা যায়নি' : 'লেখাটি পাওয়া যায়নি'}</h1><p className="mt-2 text-sm text-ink-600">{error ?? 'এই লেখা এখন প্রকাশিত নয় বা লিংকটি সঠিক নয়।'}</p><Link to="/blog" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><ArrowLeft size={15} />ব্লগে ফিরুন</Link></div></Layout>

  const title = post.seo_title || `${post.title} | BikriKoro.Com`
  const description = post.seo_description || post.excerpt
  const publishedDate = post.published_at || post.updated_at

  return <Layout wide>
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={`${SITE_URL}/blog/${post.slug}`} />
      <meta property="og:type" content="article" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {post.cover_image_url && <meta property="og:image" content={post.cover_image_url} />}
      <meta property="og:url" content={`https://bikrikoro.com/blog/${post.slug}`} />
      <script type="application/ld+json">{JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description,
        image: post.cover_image_url ? [post.cover_image_url] : undefined,
        datePublished: publishedDate,
        dateModified: post.updated_at,
        author: { '@type': 'Organization', name: 'BikriKoro' },
        publisher: { '@type': 'Organization', name: 'BikriKoro', logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
        mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
      })}</script>
    </Helmet>
    <article className="mx-auto max-w-3xl">
      <Link to="/blog" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><ArrowLeft size={15} />ব্লগে ফিরুন</Link>
      {post.cover_image_url && <img src={post.cover_image_url} alt="" className="mt-5 aspect-[16/9] w-full object-cover" />}
      <p className="mt-6 text-sm font-semibold text-brand-700">BikriKoro গাইড</p>
      <h1 className="mt-2 text-2xl font-bold leading-9 text-ink-900 sm:text-3xl">{post.title}</h1>
      <p className="mt-3 text-base leading-7 text-ink-600">{post.excerpt}</p>
      <div className="mt-7 whitespace-pre-line border-t border-outline pt-6 text-base leading-8 text-ink-700">{post.body}</div>
      <p className="mt-7 border-t border-outline pt-4 text-xs text-ink-300">প্রকাশিত: {new Date(publishedDate).toLocaleDateString('bn-BD')}</p>
    </article>
  </Layout>
}
