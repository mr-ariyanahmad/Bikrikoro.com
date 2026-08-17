import { useCallback, useEffect, useState } from 'react'
import { Archive, Eye, Image as ImageIcon, Megaphone, Send, Trash2, Upload } from 'lucide-react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'

type Mode = 'gallery' | 'downloads' | 'blog' | 'pages'
type PageType = 'ABOUT' | 'PRIVACY' | 'CONTACT' | 'HELP' | 'FAQ' | 'USER_EDU' | 'SELLER_EDU' | 'RETURN_POLICY' | 'TERMS'
type Banner = { id: string; image_url: string; target_category_id: string | null; target_product_id: string | null; sort_order: number }
type Download = { order_id: string; product_id: string; buyer_id: string; seller_id: string; delivery_type: string; delivery_text: string; status: string; created_at: string }
type Post = { id: string; title: string; slug: string; excerpt: string; status: string; created_at: string; content_type?: string }

export default function AdminContent({ mode }: { mode: Mode }) {
  const { user } = useAuth()
  const [banners, setBanners] = useState<Banner[]>([])
  const [downloads, setDownloads] = useState<Download[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [bannerForm, setBannerForm] = useState({ image_url: '', target_product_id: '', sort_order: '0' })
  const [postForm, setPostForm] = useState({ title: '', excerpt: '', body: '' })
  const [pageType, setPageType] = useState<PageType>('HELP')
  const [bannerToDelete, setBannerToDelete] = useState<Banner | null>(null)
  const [deletingBanner, setDeletingBanner] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const request = mode === 'gallery'
      ? supabase.from('promo_banners').select('*').order('sort_order')
      : mode === 'downloads'
        ? supabase.from('digital_deliveries').select('*').order('created_at', { ascending: false }).limit(100)
        : supabase.rpc('admin_list_content', { p_admin_id: user?.uid, p_content_type: mode === 'pages' ? pageType : 'BLOG' })
    request.then(({ data, error: loadError }) => {
      if (mode === 'gallery') setBanners((data ?? []) as Banner[])
      else if (mode === 'downloads') setDownloads((data ?? []) as Download[])
      else setPosts((data ?? []) as Post[])
      if (loadError) setError(`${mode === 'gallery' ? 'গ্যালারি' : mode === 'downloads' ? 'ডাউনলোড' : 'ব্লগ'} লোড করা যায়নি। 014 migration প্রয়োগ করা হয়েছে কি না দেখুন।`)
      setLoading(false)
    })
  }, [mode, pageType, user?.uid])

  useEffect(() => { load() }, [load])

  const saveBanner = async () => {
    if (!bannerForm.image_url.trim()) return
    const { error: saveError } = await supabase.rpc('admin_upsert_banner', { p_admin_id: user?.uid, p_id: `banner_${Date.now().toString(36)}`, p_image_url: bannerForm.image_url.trim(), p_target_product_id: bannerForm.target_product_id.trim() || null, p_sort_order: Number(bannerForm.sort_order || 0) })
    if (saveError) setError('Banner সেভ করা যায়নি।')
    else { setShowForm(false); setBannerForm({ image_url: '', target_product_id: '', sort_order: '0' }); load() }
  }

  const savePost = async () => {
    if (!postForm.title.trim() || !postForm.body.trim()) return
    const slug = postForm.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `post-${Date.now()}`
    const contentType = mode === 'pages' ? pageType : 'BLOG'
    const pageSlug = mode === 'pages' ? pageType.toLowerCase().replace('_', '-') : slug
    const existingPageId = mode === 'pages' ? posts[0]?.id ?? null : null
    const { error: saveError } = await supabase.rpc('admin_upsert_content', { p_admin_id: user?.uid, p_id: existingPageId, p_content_type: contentType, p_title: postForm.title.trim(), p_slug: pageSlug, p_excerpt: postForm.excerpt.trim(), p_body: postForm.body.trim(), p_status: 'DRAFT' })
    if (saveError) setError(mode === 'pages' ? 'Public page সেভ করা যায়নি।' : 'Blog post সেভ করা যায়নি।')
    else { setShowForm(false); setPostForm({ title: '', excerpt: '', body: '' }); load() }
  }

  const deleteBanner = async () => {
    if (!bannerToDelete) return
    setDeletingBanner(true)
    const { error: deleteError } = await supabase.rpc('admin_delete_banner', { p_admin_id: user?.uid, p_banner_id: bannerToDelete.id })
    if (deleteError) setError(deleteError.message.includes('permission') ? 'আপনার banner delete permission নেই।' : 'Banner মুছে ফেলা যায়নি। 026 migration প্রয়োগ হয়েছে কি না দেখুন।')
    else { setBannerToDelete(null); setError(null); load() }
    setDeletingBanner(false)
  }

  const updatePostStatus = async (post: Post, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    const { error: updateError } = await supabase.rpc('admin_set_content_status', { p_admin_id: user?.uid, p_id: post.id, p_status: status })
    if (updateError) setError('Blog status পরিবর্তন করা যায়নি।')
    else load()
  }

  const title = mode === 'gallery' ? 'গ্যালারি' : mode === 'downloads' ? 'ডিজিটাল ডাউনলোড' : mode === 'pages' ? 'পাবলিক পেজ ও Help Center' : 'নিউজ ও ব্লগ'
  return (
    <AdminShell>
      <AdminPageHeader title={title} description={mode === 'gallery' ? 'Homepage banner ও promotional creative ম্যানেজ করুন।' : mode === 'downloads' ? 'Digital order delivery readiness দেখুন।' : mode === 'pages' ? 'Website-এর Settings, Help, policy ও education content এখান থেকে publish করুন।' : 'BikriKoro-এর Bengali content draft, publish ও archive করুন।'} actions={mode !== 'downloads' && <button onClick={() => setShowForm((value) => !value)} className="inline-flex items-center gap-2 rounded-xl bg-[#0e6bdc] px-4 py-2.5 text-sm font-semibold text-white"><Upload size={16} />নতুন {mode === 'gallery' ? 'banner' : mode === 'pages' ? 'পেজ' : 'post'}</button>} />
      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {showForm && mode === 'gallery' && <AdminTableCard className="mb-5"><div className="grid gap-3 p-5 sm:grid-cols-3"><Field label="Image URL" value={bannerForm.image_url} onChange={(value) => setBannerForm({ ...bannerForm, image_url: value })} placeholder="https://..." /><Field label="Target product ID" value={bannerForm.target_product_id} onChange={(value) => setBannerForm({ ...bannerForm, target_product_id: value })} placeholder="ঐচ্ছিক" /><Field label="Sort order" value={bannerForm.sort_order} onChange={(value) => setBannerForm({ ...bannerForm, sort_order: value })} placeholder="0" /><button onClick={saveBanner} className="w-fit rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">Banner সেভ করুন</button></div></AdminTableCard>}
      {showForm && (mode === 'blog' || mode === 'pages') && <AdminTableCard className="mb-5"><div className="space-y-3 p-5">{mode === 'pages' && <label className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">পেজের ধরন</span><select value={pageType} onChange={(e) => setPageType(e.target.value as PageType)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500">{(['HELP', 'FAQ', 'ABOUT', 'PRIVACY', 'CONTACT', 'RETURN_POLICY', 'TERMS', 'USER_EDU', 'SELLER_EDU'] as PageType[]).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>}<Field label="শিরোনাম" value={postForm.title} onChange={(value) => setPostForm({ ...postForm, title: value })} placeholder="পেজের শিরোনাম" /><Field label="সংক্ষিপ্ত বিবরণ" value={postForm.excerpt} onChange={(value) => setPostForm({ ...postForm, excerpt: value })} placeholder="কিছু কথায়..." /><label className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">মূল লেখা</span><textarea value={postForm.body} onChange={(e) => setPostForm({ ...postForm, body: e.target.value })} rows={8} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500" /></label><button onClick={savePost} className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">Draft সেভ করুন</button></div></AdminTableCard>}
      {loading ? <AdminTableCard><p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p></AdminTableCard> : mode === 'gallery' ? <Gallery banners={banners} onDelete={setBannerToDelete} /> : mode === 'downloads' ? <Downloads downloads={downloads} /> : <Blog posts={posts} onStatus={updatePostStatus} showType={mode === 'pages'} />}
      <BrandedDialog open={Boolean(bannerToDelete)} title="Banner মুছে ফেলবেন?" tone="danger" onClose={() => setBannerToDelete(null)} actions={<><DialogButton onClick={() => setBannerToDelete(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={deleteBanner} tone="danger" disabled={deletingBanner}>{deletingBanner ? 'মুছছে...' : 'হ্যাঁ, মুছুন'}</DialogButton></>}><p>এই banner homepage থেকে সরিয়ে দেওয়া হবে। কাজটি admin audit log-এ সংরক্ষিত থাকবে।</p></BrandedDialog>
    </AdminShell>
  )
}

function Gallery({ banners, onDelete }: { banners: Banner[]; onDelete: (banner: Banner) => void }) { return <AdminTableCard>{banners.length === 0 ? <div className="p-10 text-center"><ImageIcon className="mx-auto text-slate-300" size={32} /><p className="mt-3 text-sm text-slate-500">এখনো কোনো banner নেই।</p></div> : <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">{banners.map((banner) => <div key={banner.id} className="overflow-hidden rounded-2xl border border-slate-200"><div className="aspect-[16/8] bg-slate-100">{banner.image_url && <img src={banner.image_url} alt="" className="h-full w-full object-cover" />}</div><div className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="text-xs text-slate-500">Sort {banner.sort_order}</p><p className="mt-1 truncate text-sm font-semibold text-slate-800">{banner.id}</p></div><div className="flex items-center gap-1"><Megaphone size={17} className="text-brand-600" /><button type="button" onClick={() => onDelete(banner)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Banner মুছুন"><Trash2 size={16} /></button></div></div></div>)}</div>}</AdminTableCard> }
function Downloads({ downloads }: { downloads: Download[] }) { return <AdminTableCard>{downloads.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো digital delivery record নেই।</p> : <div className="divide-y divide-slate-100">{downloads.map((download) => <div key={download.order_id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-sm text-slate-800">Order {download.order_id.slice(0, 10)}</p><p className="mt-1 text-xs text-slate-400">Product {download.product_id.slice(0, 10)} · buyer {download.buyer_id.slice(0, 10)}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${download.status === 'READY' ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>{download.status}</span></div>)}</div>}</AdminTableCard> }
function Blog({ posts, onStatus, showType = false }: { posts: Post[]; onStatus: (post: Post, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => void; showType?: boolean }) { return <AdminTableCard>{posts.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো content নেই। নতুন draft তৈরি করুন।</p> : <div className="divide-y divide-slate-100">{posts.map((post) => <div key={post.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-800">{post.title}</p><p className="mt-1 text-xs text-slate-400">{showType && `${post.content_type ?? ''} · `}/{post.slug} · {formatDateTime(post.created_at)}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{post.status}</span>{post.status !== 'PUBLISHED' && <button onClick={() => onStatus(post, 'PUBLISHED')} className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700"><Send size={13} />Publish</button>}{post.status === 'PUBLISHED' && <button onClick={() => onStatus(post, 'DRAFT')} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-700"><Eye size={13} />Unpublish</button>}{post.status !== 'ARCHIVED' && <button onClick={() => onStatus(post, 'ARCHIVED')} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"><Archive size={13} />Archive</button>}</div></div>)}</div>}</AdminTableCard> }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500" /></label> }
