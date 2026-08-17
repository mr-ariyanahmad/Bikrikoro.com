import { useCallback, useEffect, useMemo, useState } from 'react'
import { Edit3, Eye, EyeOff, Plus, RotateCcw, Save, Tags, Trash2 } from 'lucide-react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { formatTaka } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { BrandedDialog, DialogButton, DialogInput } from '@/components/BrandedDialog'
import type { Category, Product } from '@/types/product'

type Mode = 'products' | 'categories' | 'industries'
type AdminProduct = Product & { is_hidden?: boolean }
type ProductDraft = { title: string; description: string; price: string; category_id: string; condition: 'NEW' | 'USED'; location: string; images: string }

export default function AdminCatalogue({ mode = 'products' }: { mode?: Mode }) {
  const { user } = useAuth()
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminProduct | null>(null)
  const [draft, setDraft] = useState<ProductDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [moderationTarget, setModerationTarget] = useState<{ product: AdminProduct; action: 'HIDE' | 'RESTORE' | 'DELETE' } | null>(null)
  const [categoryPrompt, setCategoryPrompt] = useState<{ category: Category | null; value: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (mode === 'products') {
      const { data, error: loadError } = await supabase.rpc('admin_list_products', { p_admin_id: user?.uid })
      setProducts((data ?? []) as AdminProduct[])
      if (loadError) setError('প্রোডাক্ট লোড করা যায়নি। 014 migration প্রয়োগ করা হয়েছে কি না দেখুন।')
    } else {
      const { data, error: loadError } = await supabase.from('categories').select('*').order('sort_order')
      setCategories((data ?? []) as Category[])
      if (loadError) setError('ক্যাটাগরি লোড করা যায়নি।')
    }
    setLoading(false)
  }, [mode, user?.uid])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    return value ? products.filter((product) => `${product.title} ${product.description} ${product.location} ${product.category_id}`.toLowerCase().includes(value)) : products
  }, [products, query])

  const openEditor = (product: AdminProduct) => {
    setEditing(product)
    setDraft({ title: product.title, description: product.description, price: String(product.price), category_id: product.category_id, condition: product.condition, location: product.location, images: product.images.join('\n') })
  }

  const saveProduct = async () => {
    if (!editing || !draft || !draft.title.trim() || Number(draft.price) <= 0) return
    setSaving(true)
    const { error: saveError } = await supabase.rpc('admin_update_product', {
      p_admin_id: user?.uid,
      p_product_id: editing.id,
      p_title: draft.title.trim(),
      p_description: draft.description.trim(),
      p_price: Number(draft.price),
      p_category_id: draft.category_id,
      p_condition: draft.condition,
      p_location: draft.location.trim(),
      p_images: draft.images.split('\n').map((value) => value.trim()).filter(Boolean),
    })
    setSaving(false)
    if (saveError) { setError('প্রোডাক্ট আপডেট করা যায়নি। 014 migration প্রয়োগ করা হয়েছে কি না দেখুন。'); return }
    setEditing(null); setDraft(null); load()
  }

  const moderate = async (product: AdminProduct, action: 'HIDE' | 'RESTORE' | 'DELETE') => {
    const { error: actionError } = await supabase.rpc('admin_moderate_product', { p_admin_id: user?.uid, p_product_id: product.id, p_action: action })
    if (actionError) setError('প্রোডাক্ট action সম্পন্ন হয়নি।')
    else load()
    setModerationTarget(null)
  }

  const addCategory = () => setCategoryPrompt({ category: null, value: '' })
  const renameCategory = (category: Category) => setCategoryPrompt({ category, value: category.name })
  const saveCategoryPrompt = async () => {
    if (!categoryPrompt?.value.trim()) return
    const name = categoryPrompt.value.trim()
    const id = categoryPrompt.category?.id ?? `cat_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`
    if (categoryPrompt.category && name === categoryPrompt.category.name) { setCategoryPrompt(null); return }
    const { error: categoryError } = await supabase.rpc('admin_upsert_category', { p_admin_id: user?.uid, p_id: id, p_name: name, p_sort_order: categoryPrompt.category?.sort_order ?? categories.length + 1 })
    if (categoryError) setError(categoryPrompt.category ? 'ক্যাটাগরি আপডেট করা যায়নি।' : 'ক্যাটাগরি যোগ করা যায়নি।')
    else { setCategoryPrompt(null); load() }
  }

  const title = mode === 'products' ? 'প্রোডাক্ট' : mode === 'categories' ? 'ক্যাটাগরি' : 'ইন্ডাস্ট্রি'
  return (
    <AdminShell>
      <AdminPageHeader title={title} description={mode === 'products' ? 'BikriKoro-এর live listing edit, publish ও archive করুন।' : mode === 'categories' ? 'প্রোডাক্ট taxonomy ও category name/order ম্যানেজ করুন।' : 'ভবিষ্যৎ industry taxonomy-এর জন্য app-native grouping।'} actions={mode === 'categories' ? <button onClick={addCategory} className="inline-flex items-center gap-2 rounded-xl bg-[#0e6bdc] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />নতুন category</button> : undefined} />
      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {mode === 'products' ? <>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title, description, location বা category খুঁজুন..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500" /><span className="flex items-center rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-500">{filtered.length.toLocaleString('bn-BD')}টি listing</span></div>
        <AdminTableCard>
          <div className="hidden grid-cols-[1.7fr_0.8fr_0.7fr_0.8fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid"><span>Listing</span><span>দাম</span><span>ধরন</span><span>ভিজিবিলিটি</span><span>Control</span></div>
          {loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : filtered.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো প্রোডাক্ট পাওয়া যায়নি।</p> : <div className="divide-y divide-slate-100">{filtered.map((product) => <div key={product.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.7fr_0.8fr_0.7fr_0.8fr_1fr] md:items-center md:gap-4"><div className="flex min-w-0 items-center gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">{product.images[0] && <img src={product.images[0]} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{product.title}</p><p className="mt-1 truncate text-xs text-slate-400">{product.category_id} · {product.view_count} views · {product.is_digital ? 'ডিজিটাল' : 'ফিজিক্যাল'}</p></div></div><p className="font-semibold text-brand-700">{formatTaka(product.price)}</p><p className="text-sm text-slate-600">{product.condition === 'NEW' ? 'নতুন' : 'ব্যবহৃত'}</p><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${product.is_hidden ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-700'}`}>{product.is_hidden ? 'অপ্রকাশিত' : 'লাইভ'}</span><div className="flex flex-wrap gap-2"><button title="Edit listing" onClick={() => openEditor(product)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600"><Edit3 size={14} />Edit</button>{product.is_hidden ? <button title="Restore listing" onClick={() => setModerationTarget({ product, action: 'RESTORE' })} className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700"><RotateCcw size={14} />Restore</button> : <button title="Hide listing" onClick={() => setModerationTarget({ product, action: 'HIDE' })} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-700"><EyeOff size={14} />Hide</button>}<button title="Archive listing" onClick={() => setModerationTarget({ product, action: 'DELETE' })} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"><Trash2 size={14} />Archive</button></div></div>)}</div>}
        </AdminTableCard>
      </> : mode === 'categories' ? <AdminTableCard><div className="divide-y divide-slate-100">{loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : categories.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো category নেই।</p> : categories.map((category) => <div key={category.id} className="flex items-center justify-between gap-3 px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="rounded-xl bg-brand-50 p-2 text-brand-700"><Tags size={16} /></span><div><p className="font-semibold text-slate-800">{category.name}</p><p className="mt-1 text-xs text-slate-400">{category.id} · Sort {category.sort_order}</p></div></div><button onClick={() => renameCategory(category)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600"><Edit3 size={14} />Rename</button></div>)}</div></AdminTableCard> : <AdminTableCard><div className="p-10 text-center"><FactoryIcon /><p className="mt-3 font-semibold text-slate-800">Industry taxonomy এখনো configure করা হয়নি</p><p className="mt-1 text-sm text-slate-500">BikriKoro-এর business category চূড়ান্ত হলে এখানে grouping যোগ করা যাবে।</p></div></AdminTableCard>}
      <BrandedDialog open={Boolean(moderationTarget)} title={moderationTarget?.action === 'RESTORE' ? 'Listing আবার প্রকাশ করবেন?' : moderationTarget?.action === 'DELETE' ? 'Listing archive করবেন?' : 'Listing লুকাবেন?'} tone={moderationTarget?.action === 'RESTORE' ? 'brand' : 'warning'} onClose={() => setModerationTarget(null)} actions={<><DialogButton onClick={() => setModerationTarget(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={() => moderationTarget && moderate(moderationTarget.product, moderationTarget.action)} tone={moderationTarget?.action === 'RESTORE' ? 'brand' : 'warning'}>নিশ্চিত করুন</DialogButton></>}><p>এই action-এর পরে product visibility পরিবর্তন হবে এবং admin audit log-এ রাখা হবে।</p></BrandedDialog><BrandedDialog open={Boolean(categoryPrompt)} title={categoryPrompt?.category ? 'Category-এর নাম বদলান' : 'নতুন category'} onClose={() => setCategoryPrompt(null)} actions={<><DialogButton onClick={() => setCategoryPrompt(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={saveCategoryPrompt}>সেভ করুন</DialogButton></>}><p>বাংলায় সহজে বোঝা যায় এমন একটি category নাম লিখুন।</p><DialogInput value={categoryPrompt?.value ?? ''} onChange={(value) => setCategoryPrompt((current) => current ? { ...current, value } : current)} placeholder="যেমন: মোবাইল" /></BrandedDialog>{editing && draft && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-bold text-slate-900">Listing edit করুন</h2><p className="mt-1 text-xs text-slate-500">{editing.id}</p></div><button onClick={() => { setEditing(null); setDraft(null) }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-500">বন্ধ</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Input label="Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} /><Input label="Price" type="number" value={draft.price} onChange={(value) => setDraft({ ...draft, price: value })} /><Input label="Category ID" value={draft.category_id} onChange={(value) => setDraft({ ...draft, category_id: value })} /><Input label="Location" value={draft.location} onChange={(value) => setDraft({ ...draft, location: value })} /><label className="text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">Condition</span><select value={draft.condition} onChange={(e) => setDraft({ ...draft, condition: e.target.value as 'NEW' | 'USED' })} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500"><option value="NEW">নতুন</option><option value="USED">ব্যবহৃত</option></select></label><Input label="Image URLs (প্রতি লাইনে একটি)" value={draft.images} onChange={(value) => setDraft({ ...draft, images: value })} /></div><label className="mt-4 block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">Description</span><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={5} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500" /></label><button onClick={saveProduct} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0e6bdc] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{saving ? 'সেভ হচ্ছে...' : 'Listing save করুন'}</button></div></div>}
    </AdminShell>
  )
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500" /></label> }
function FactoryIcon() { return <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Eye size={22} /></span> }
