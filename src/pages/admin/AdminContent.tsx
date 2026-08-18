import { useCallback, useEffect, useState } from 'react'
import { Archive, Edit3, Eye, Image as ImageIcon, Megaphone, Send, Trash2, Upload } from 'lucide-react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'
import { BrandSelect } from '@/components/BrandSelect'

type Mode = 'gallery' | 'downloads' | 'blog' | 'pages' | 'faq'
type PageType = 'ABOUT' | 'PRIVACY' | 'CONTACT' | 'HELP' | 'USER_EDU' | 'SELLER_EDU' | 'RETURN_POLICY' | 'TERMS'
type Banner = { id: string; image_url: string; target_category_id: string | null; target_product_id: string | null; sort_order: number }
type Download = { order_id: string; product_id: string; buyer_id: string; seller_id: string; delivery_type: string; delivery_text: string; status: string; created_at: string }
type Post = { id: string; title: string; slug: string; excerpt: string; body: string; status: string; created_at: string; content_type?: string; cover_image_url?: string | null; seo_title?: string | null; seo_description?: string | null; sort_order?: number }
type PostForm = { title: string; slug: string; excerpt: string; body: string; cover_image_url: string; seo_title: string; seo_description: string; sort_order: string }

const EMPTY_POST: PostForm = { title: '', slug: '', excerpt: '', body: '', cover_image_url: '', seo_title: '', seo_description: '', sort_order: '0' }

export default function AdminContent({ mode }: { mode: Mode }) {
  const { user } = useAuth()
  const [banners, setBanners] = useState<Banner[]>([])
  const [downloads, setDownloads] = useState<Download[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [bannerForm, setBannerForm] = useState({ image_url: '', target_product_id: '', sort_order: '0' })
  const [postForm, setPostForm] = useState<PostForm>(EMPTY_POST)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [pageType, setPageType] = useState<PageType>('HELP')
  const [bannerToDelete, setBannerToDelete] = useState<Banner | null>(null)
  const [deletingBanner, setDeletingBanner] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const request = mode === 'gallery'
      ? supabase.from('promo_banners').select('*').order('sort_order')
      : mode === 'downloads'
        ? supabase.from('digital_deliveries').select('*').order('created_at', { ascending: false }).limit(100)
        : supabase.rpc('admin_list_content', { p_admin_id: user?.uid, p_content_type: mode === 'pages' ? pageType : mode === 'faq' ? 'FAQ' : 'BLOG' })
    request.then(({ data, error: loadError }) => {
      if (mode === 'gallery') setBanners((data ?? []) as Banner[])
      else if (mode === 'downloads') setDownloads((data ?? []) as Download[])
      else setPosts((data ?? []) as Post[])
      if (loadError) setError(formatAdminRpcError(loadError, mode === 'gallery' ? 'গ্যালারি data' : mode === 'downloads' ? 'ডাউনলোড data' : 'কনটেন্ট data', mode === 'gallery' ? '016 public expansion migration' : mode === 'downloads' ? '014 admin workspace migration' : '035 content/SEO migration'))
      setLoading(false)
    })
  }, [mode, pageType, user?.uid])

  useEffect(() => { load() }, [load])

  const saveBanner = async () => {
    if (!bannerForm.image_url.trim()) return
    const { error: saveError } = await supabase.rpc('admin_upsert_banner', { p_admin_id: user?.uid, p_id: `banner_${Date.now().toString(36)}`, p_image_url: bannerForm.image_url.trim(), p_target_product_id: bannerForm.target_product_id.trim() || null, p_sort_order: Number(bannerForm.sort_order || 0) })
    if (saveError) setError(formatAdminRpcError(saveError, 'Banner save', '014 admin workspace migration'))
    else { setShowForm(false); setBannerForm({ image_url: '', target_product_id: '', sort_order: '0' }); load() }
  }

  const savePost = async () => {
    if (!postForm.title.trim() || !postForm.body.trim()) return
    const slug = postForm.slug.trim() || postForm.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `post-${Date.now()}`
    const contentType = mode === 'pages' ? pageType : mode === 'faq' ? 'FAQ' : 'BLOG'
    const pageSlug = mode === 'pages' ? pageType.toLowerCase().replace('_', '-') : slug
    const currentPost = editingPostId ? posts.find((post) => post.id === editingPostId) : undefined
    const { error: saveError } = await supabase.rpc('admin_upsert_content', {
      p_admin_id: user?.uid,
      p_id: editingPostId ?? (mode === 'pages' ? posts[0]?.id ?? null : null),
      p_content_type: contentType,
      p_title: postForm.title.trim(),
      p_slug: pageSlug,
      p_excerpt: postForm.excerpt.trim(),
      p_body: postForm.body.trim(),
      p_status: currentPost?.status ?? 'DRAFT',
      p_cover_image_url: mode === 'blog' ? postForm.cover_image_url.trim() || null : null,
      p_seo_title: postForm.seo_title.trim() || null,
      p_seo_description: postForm.seo_description.trim() || null,
      p_sort_order: mode === 'faq' ? Number(postForm.sort_order || 0) : 0,
    })
    if (saveError) setError(formatAdminRpcError(saveError, mode === 'pages' ? 'Public page save' : mode === 'faq' ? 'FAQ save' : 'Blog post save', mode === 'faq' ? '036 FAQ migration' : '035 content/SEO migration'))
    else { resetPostForm(); load() }
  }

  const startEdit = (post: Post) => {
    setEditingPostId(post.id)
    setPostForm({ title: post.title, slug: post.slug, excerpt: post.excerpt, body: post.body, cover_image_url: post.cover_image_url ?? '', seo_title: post.seo_title ?? '', seo_description: post.seo_description ?? '', sort_order: String(post.sort_order ?? 0) })
    setShowForm(true)
  }

  const resetPostForm = () => {
    setShowForm(false)
    setEditingPostId(null)
    setPostForm(EMPTY_POST)
  }

  const deleteBanner = async () => {
    if (!bannerToDelete) return
    setDeletingBanner(true)
    const { error: deleteError } = await supabase.rpc('admin_delete_banner', { p_admin_id: user?.uid, p_banner_id: bannerToDelete.id })
    if (deleteError) setError(formatAdminRpcError(deleteError, 'Banner delete', '016 public expansion migration'))
    else { setBannerToDelete(null); setError(null); load() }
    setDeletingBanner(false)
  }

  const updatePostStatus = async (post: Post, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    const { error: updateError } = await supabase.rpc('admin_set_content_status', { p_admin_id: user?.uid, p_id: post.id, p_status: status })
    if (updateError) setError(formatAdminRpcError(updateError, 'Content status update', '035 content/SEO migration'))
    else load()
  }

  const title = mode === 'gallery' ? 'গ্যালারি' : mode === 'downloads' ? 'ডিজিটাল ডাউনলোড' : mode === 'pages' ? 'পাবলিক পেজ ও Help Center' : mode === 'faq' ? 'FAQ প্রশ্ন ও উত্তর' : 'নিউজ ও ব্লগ'
  return (
    <AdminShell>
      <AdminPageHeader title={title} description={mode === 'gallery' ? 'Homepage banner ও promotional creative ম্যানেজ করুন।' : mode === 'downloads' ? 'Digital order delivery readiness দেখুন।' : mode === 'pages' ? 'Website-এর Settings, Help, policy ও education content এখান থেকে publish করুন।' : mode === 'faq' ? 'Buyer, seller, payment, order, delivery, dispute ও account-এর প্রশ্ন-উত্তর ম্যানেজ করুন।' : 'BikriKoro-এর Bengali blog draft, SEO fields, cover image এবং publication পরিচালনা করুন।'} actions={mode !== 'downloads' && <button onClick={() => { setEditingPostId(null); setPostForm(EMPTY_POST); setShowForm((value) => !value) }} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white"><Upload size={16} />নতুন {mode === 'gallery' ? 'banner' : mode === 'pages' ? 'পেজ' : mode === 'faq' ? 'প্রশ্ন' : 'post'}</button>} />
      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {showForm && mode === 'gallery' && <AdminTableCard className="mb-5"><div className="grid gap-3 p-5 sm:grid-cols-3"><Field label="Image URL" value={bannerForm.image_url} onChange={(value) => setBannerForm({ ...bannerForm, image_url: value })} placeholder="https://..." /><Field label="Target product ID" value={bannerForm.target_product_id} onChange={(value) => setBannerForm({ ...bannerForm, target_product_id: value })} placeholder="ঐচ্ছিক" /><Field label="Sort order" value={bannerForm.sort_order} onChange={(value) => setBannerForm({ ...bannerForm, sort_order: value })} placeholder="0" /><button onClick={saveBanner} className="w-fit rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">Banner সেভ করুন</button></div></AdminTableCard>}
      {showForm && (mode === 'blog' || mode === 'pages' || mode === 'faq') && <AdminTableCard className="mb-5"><div className="space-y-3 p-5">{mode === 'pages' && <BrandSelect label="পেজের ধরন" value={pageType} options={(['HELP', 'ABOUT', 'PRIVACY', 'CONTACT', 'RETURN_POLICY', 'TERMS', 'USER_EDU', 'SELLER_EDU'] as PageType[]).map((value) => ({ value, label: value }))} onChange={(value) => setPageType(value as PageType)} />}<Field label="শিরোনাম" value={postForm.title} onChange={(value) => setPostForm({ ...postForm, title: value })} placeholder="কনটেন্টের শিরোনাম" />{(mode === 'blog' || mode === 'faq') && <Field label="Slug" value={postForm.slug} onChange={(value) => setPostForm({ ...postForm, slug: value })} placeholder="english-url-slug" />}<Field label="সংক্ষিপ্ত বিবরণ" value={postForm.excerpt} onChange={(value) => setPostForm({ ...postForm, excerpt: value })} placeholder="কিছু কথায়..." />{mode === 'blog' && <Field label="Cover image URL" value={postForm.cover_image_url} onChange={(value) => setPostForm({ ...postForm, cover_image_url: value })} placeholder="/blog-cover.jpg অথবা Supabase public URL" />}{mode === 'faq' && <Field label="প্রদর্শনের ক্রম" value={postForm.sort_order} onChange={(value) => setPostForm({ ...postForm, sort_order: value })} placeholder="10" />}<Field label="SEO title" value={postForm.seo_title} onChange={(value) => setPostForm({ ...postForm, seo_title: value })} placeholder="Google result title" /><Field label="SEO description" value={postForm.seo_description} onChange={(value) => setPostForm({ ...postForm, seo_description: value })} placeholder="Google result description" /><label className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">মূল লেখা</span><textarea value={postForm.body} onChange={(e) => setPostForm({ ...postForm, body: e.target.value })} rows={10} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" /></label><div className="flex flex-wrap gap-2"><button onClick={savePost} className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">{editingPostId ? 'পরিবর্তন সেভ করুন' : 'Draft সেভ করুন'}</button><button onClick={resetPostForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">বাতিল</button></div></div></AdminTableCard>}
      {loading ? <AdminTableCard><p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p></AdminTableCard> : mode === 'gallery' ? <Gallery banners={banners} onDelete={setBannerToDelete} /> : mode === 'downloads' ? <Downloads downloads={downloads} /> : <Blog posts={posts} onEdit={startEdit} onStatus={updatePostStatus} showType={mode === 'pages'} isFaq={mode === 'faq'} />}
      <BrandedDialog open={Boolean(bannerToDelete)} title="Banner মুছে ফেলবেন?" tone="danger" onClose={() => setBannerToDelete(null)} actions={<><DialogButton onClick={() => setBannerToDelete(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={deleteBanner} tone="danger" disabled={deletingBanner}>{deletingBanner ? 'মুছছে...' : 'হ্যাঁ, মুছুন'}</DialogButton></>}><p>এই banner homepage থেকে সরিয়ে দেওয়া হবে। কাজটি admin audit log-এ সংরক্ষিত থাকবে।</p></BrandedDialog>
    </AdminShell>
  )
}

function Gallery({ banners, onDelete }: { banners: Banner[]; onDelete: (banner: Banner) => void }) { return <AdminTableCard>{banners.length === 0 ? <div className="p-10 text-center"><ImageIcon className="mx-auto text-slate-300" size={32} /><p className="mt-3 text-sm text-slate-500">এখনো কোনো banner নেই।</p></div> : <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">{banners.map((banner) => <div key={banner.id} className="overflow-hidden rounded-2xl border border-slate-200"><div className="aspect-[16/8] bg-slate-100">{banner.image_url && <img src={banner.image_url} alt="" className="h-full w-full object-cover" />}</div><div className="flex items-center justify-between gap-3 p-3"><div className="min-w-0"><p className="text-xs text-slate-500">Sort {banner.sort_order}</p><p className="mt-1 truncate text-sm font-semibold text-slate-800">{banner.id}</p></div><div className="flex items-center gap-1"><Megaphone size={17} className="text-brand-600" /><button type="button" onClick={() => onDelete(banner)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Banner মুছুন"><Trash2 size={16} /></button></div></div></div>)}</div>}</AdminTableCard> }
function Downloads({ downloads }: { downloads: Download[] }) { return <AdminTableCard>{downloads.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো digital delivery record নেই।</p> : <div className="divide-y divide-slate-100">{downloads.map((download) => <div key={download.order_id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-sm text-slate-800">Order {download.order_id.slice(0, 10)}</p><p className="mt-1 text-xs text-slate-400">Product {download.product_id.slice(0, 10)} · buyer {download.buyer_id.slice(0, 10)}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${download.status === 'READY' ? 'bg-brand-50 text-brand-700' : 'bg-amber-50 text-amber-700'}`}>{download.status}</span></div>)}</div>}</AdminTableCard> }
function Blog({ posts, onEdit, onStatus, showType = false, isFaq = false }: { posts: Post[]; onEdit: (post: Post) => void; onStatus: (post: Post, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => void; showType?: boolean; isFaq?: boolean }) { return <AdminTableCard>{posts.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো content নেই। নতুন draft তৈরি করুন।</p> : <div className="divide-y divide-slate-100">{posts.map((post) => <div key={post.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-3">{post.cover_image_url ? <img src={post.cover_image_url} alt="" className="h-12 w-20 shrink-0 object-cover" /> : <div className="h-12 w-20 shrink-0 bg-brand-50" />}<div className="min-w-0"><p className="truncate font-semibold text-slate-800">{post.title}</p><p className="mt-1 text-xs text-slate-400">{isFaq && `ক্রম ${post.sort_order ?? 0} · `}{showType && `${post.content_type ?? ''} · `}/{post.slug} · {formatDateTime(post.created_at)}</p></div></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{post.status}</span><button onClick={() => onEdit(post)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600"><Edit3 size={13} />সম্পাদনা</button>{post.status !== 'PUBLISHED' && <button onClick={() => onStatus(post, 'PUBLISHED')} className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700"><Send size={13} />প্রকাশ করুন</button>}{post.status === 'PUBLISHED' && <button onClick={() => onStatus(post, 'DRAFT')} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-700"><Eye size={13} />আনপাবলিশ</button>}{post.status !== 'ARCHIVED' && <button onClick={() => onStatus(post, 'ARCHIVED')} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"><Archive size={13} />আর্কাইভ</button>}</div></div>)}</div>}</AdminTableCard> }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) { return <label className="block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" /></label> }
