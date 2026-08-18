import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { supabase } from '@/lib/supabase'
import { SITE_URL } from '@/lib/site'

type BlogPost = { id: string; title: string; slug: string; excerpt: string; body: string; cover_image_url: string | null; seo_title: string | null; seo_description: string | null; published_at: string | null; updated_at: string }

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data, error: loadError } = await supabase.rpc('get_published_content', { p_content_type: 'BLOG', p_slug: null })
        if (loadError) throw loadError
        if (!active) return
        setPosts((data ?? []) as BlogPost[])
      } catch (loadError) {
        console.error('Blog load failed:', loadError)
        if (active) setError(loadError instanceof Error ? loadError.message : 'ব্লগ লোড করা যায়নি।')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  return <Layout wide>
    <Helmet>
      <title>ব্লগ ও গাইড | BikriKoro.Com</title>
      <meta name="description" content="BikriKoro-তে নিরাপদ কেনাকাটা, trusted seller এবং ভালো product listing নিয়ে বাংলা গাইড।" />
      <link rel="canonical" href={`${SITE_URL}/blog`} />
    </Helmet>
    <div className="mx-auto max-w-5xl">
      <header className="border-b border-outline pb-5">
        <div className="flex items-center gap-2 text-brand-700"><BookOpen size={18} /><span className="text-sm font-semibold">BikriKoro গাইড</span></div>
        <h1 className="mt-2 text-2xl font-bold text-ink-900 sm:text-3xl">নিরাপদ কেনাকাটা ও বিক্রির গাইড</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">বাংলাদেশি buyer ও seller-দের জন্য practical marketplace শিক্ষা, নিরাপত্তা এবং listing tips।</p>
      </header>
      {error && <p className="mt-6 border border-error/20 bg-error/5 p-4 text-sm text-error">ব্লগ লোড করা যায়নি: {error}</p>}
      {loading ? <div className="mt-6 grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse bg-outline/40" />)}</div> : posts.length === 0 ? <p className="mt-8 border border-outline bg-surface p-6 text-sm text-ink-600">এখনো কোনো blog প্রকাশিত হয়নি।</p> : <div className="mt-6 grid gap-4 md:grid-cols-3">{posts.map((post) => <article key={post.id} className="overflow-hidden border border-outline bg-surface"><Link to={`/blog/${post.slug}`} className="block"><div className="aspect-[16/9] bg-brand-50">{post.cover_image_url && <img src={post.cover_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />}</div><div className="p-4"><h2 className="text-base font-bold leading-6 text-ink-900">{post.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-ink-600">{post.excerpt}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">পড়ুন <ArrowRight size={15} /></span></div></Link></article>)}</div>}
    </div>
  </Layout>
}
