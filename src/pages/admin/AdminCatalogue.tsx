import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { formatTaka } from '@/lib/format'
import type { Product, Category } from '@/types/product'

type Mode = 'products' | 'categories' | 'industries'
export default function AdminCatalogue({ mode = 'products' }: { mode?: Mode }) {
  const { user } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    if (mode === 'products') {
      const { data, error: loadError } = await supabase.rpc('admin_list_products', { p_admin_id: user?.uid })
      setProducts((data ?? []) as Product[]); if (loadError) setError('প্রোডাক্ট লোড করা যায়নি।')
    } else {
      const { data, error: loadError } = await supabase.from('categories').select('*').order('sort_order')
      setCategories((data ?? []) as Category[]); if (loadError) setError('ক্যাটাগরি লোড করা যায়নি।')
    }
    setLoading(false)
  }, [mode, user?.uid])
  useEffect(() => { load() }, [load])
  const filtered = useMemo(() => { const value = query.trim().toLowerCase(); return value ? products.filter((product) => `${product.title} ${product.description} ${product.location}`.toLowerCase().includes(value)) : products }, [products, query])
  const moderate = async (product: Product, action: 'HIDE' | 'RESTORE' | 'DELETE') => {
    const { error: actionError } = await supabase.rpc('admin_moderate_product', { p_admin_id: user?.uid, p_product_id: product.id, p_action: action })
    if (actionError) { setError('প্রোডাক্ট action সম্পন্ন হয়নি। নতুন admin migration প্রয়োগ করা হয়েছে কি না দেখুন।'); return }
    load()
  }
  const addCategory = async () => {
    const name = window.prompt('নতুন category-এর নাম')?.trim()
    if (!name) return
    const id = `cat_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`
    const { error: insertError } = await supabase.rpc('admin_upsert_category', { p_admin_id: user?.uid, p_id: id, p_name: name, p_sort_order: categories.length + 1 })
    if (insertError) setError('ক্যাটাগরি যোগ করা যায়নি। নতুন admin migration প্রয়োগ করা হয়েছে কি না দেখুন।'); else load()
  }
  const title = mode === 'products' ? 'প্রোডাক্ট' : mode === 'categories' ? 'ক্যাটাগরি' : 'ইন্ডাস্ট্রি'
  return <AdminShell><AdminPageHeader title={title} description={mode === 'products' ? 'ক্যাটালগের listing review, hide এবং restore করুন।' : mode === 'categories' ? 'প্রোডাক্ট taxonomy ও category order ম্যানেজ করুন।' : 'ভবিষ্যৎ industry taxonomy-এর জন্য catalogue grouping।'} actions={mode === 'categories' ? <button onClick={addCategory} className="rounded-xl bg-[#0e6bdc] px-4 py-2.5 text-sm font-semibold text-white">+ নতুন category</button> : undefined} />{error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{mode === 'products' ? <><div className="mb-5"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="প্রোডাক্ট, বিবরণ বা লোকেশন খুঁজুন..." className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500" /></div><AdminTableCard><div className="hidden grid-cols-[1.6fr_0.8fr_0.7fr_0.8fr_0.7fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid"><span>প্রোডাক্ট</span><span>দাম</span><span>ধরন</span><span>ক্যাটাগরি</span><span>অ্যাকশন</span></div>{loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : filtered.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো প্রোডাক্ট পাওয়া যায়নি।</p> : <div className="divide-y divide-slate-100">{filtered.map((product) => <div key={product.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.6fr_0.8fr_0.7fr_0.8fr_0.7fr] md:items-center md:gap-4"><div className="flex min-w-0 items-center gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">{product.images[0] && <img src={product.images[0]} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{product.title}</p><p className="mt-1 text-xs text-slate-400">{product.view_count} views · {product.is_digital ? 'ডিজিটাল' : 'ফিজিক্যাল'}</p></div></div><p className="font-semibold text-brand-700">{formatTaka(product.price)}</p><p className="text-sm text-slate-600">{product.condition === 'NEW' ? 'নতুন' : 'ব্যবহৃত'}</p><p className="text-sm text-slate-600">{product.category_id}</p><div className="flex gap-2"><button onClick={() => moderate(product, 'HIDE')} className="rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50">Hide</button><button onClick={() => moderate(product, 'DELETE')} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button></div></div>)}</div>}</AdminTableCard></> : <AdminTableCard><div className="divide-y divide-slate-100">{loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : categories.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো category নেই।</p> : categories.map((category) => <div key={category.id} className="flex items-center justify-between gap-3 px-5 py-4"><div><p className="font-semibold text-slate-800">{category.name}</p><p className="mt-1 text-xs text-slate-400">{category.id}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Sort {category.sort_order}</span></div>)}</div></AdminTableCard>}</AdminShell>
}
