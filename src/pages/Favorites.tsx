import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { ProductCard } from '@/components/ProductCard'
import type { Product } from '@/types/product'

export default function Favorites() {
  const { user } = useAuth()
  const uid = user!.uid
  const [products, setProducts] = useState<Product[]>([])
  const [folders, setFolders] = useState<Array<{ id: string; name: string; color: string }>>([])
  const [folderByProduct, setFolderByProduct] = useState<Record<string, string>>({})
  const [selectedFolder, setSelectedFolder] = useState('all')
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      let { data: favs, error: favoritesError } = await supabase.from('favorites').select('product_id, folder_id').eq('user_id', uid)
      if (favoritesError) {
        const fallback = await supabase.from('favorites').select('product_id').eq('user_id', uid)
        favs = (fallback.data ?? []).map((item) => ({ ...item, folder_id: null }))
      }
      const rows = favs ?? []
      setFolderByProduct(Object.fromEntries(rows.map((row) => [row.product_id, row.folder_id ?? ''])))
      const ids = rows.map((f) => f.product_id)
      const { data: folderData } = await supabase.from('wishlist_folders').select('id, name, color').eq('user_id', uid).order('created_at')
      setFolders(folderData ?? [])
      if (ids.length === 0) {
        setProducts([])
        setLoading(false)
        return
      }
      const { data } = await supabase.from('products').select('*').in('id', ids)
      setProducts(data ?? [])
      setLoading(false)
    }
    load()
  }, [uid])

  const createFolder = async () => {
    if (!newFolderName.trim()) return
    const { data, error } = await supabase.rpc('create_wishlist_folder', { p_user_id: uid, p_name: newFolderName.trim(), p_color: 'brand' })
    if (!error && data) { setFolders((current) => [...current, { id: data, name: newFolderName.trim(), color: 'brand' }]); setNewFolderName(''); setCreatingFolder(false) }
  }
  const assignFolder = async (productId: string, folderId: string) => {
    setFolderByProduct((current) => ({ ...current, [productId]: folderId }))
    await supabase.rpc('set_favorite_folder', { p_user_id: uid, p_product_id: productId, p_folder_id: folderId || null })
  }
  const visibleProducts = useMemo(() => selectedFolder === 'all' ? products : products.filter((product) => folderByProduct[product.id] === selectedFolder), [folderByProduct, products, selectedFolder])

  return (
    <Layout wide>
      <Helmet>
        <title>পছন্দের তালিকা | BikriKoro.Com</title>
      </Helmet>

      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold text-ink-900">পছন্দের তালিকা</h1><p className="mt-1 text-sm text-ink-500">পণ্যগুলো folder করে আলাদা করে রাখুন।</p></div><button onClick={() => setCreatingFolder((value) => !value)} className="inline-flex items-center gap-1.5 rounded-xl border border-brand-500 px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"><Plus size={16} />নতুন folder</button></div>
      {creatingFolder && <div className="mt-4 flex gap-2 rounded-2xl border border-outline bg-surface p-3"><input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createFolder()} placeholder="যেমন: পরে কিনব" className="min-w-0 flex-1 rounded-xl border border-outline px-3 py-2 text-sm outline-none focus:border-brand-500" /><button onClick={createFolder} className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">সেভ</button></div>}
      <div className="scrollbar-none mt-5 flex gap-2 overflow-x-auto pb-1"><button onClick={() => setSelectedFolder('all')} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold ${selectedFolder === 'all' ? 'bg-brand-500 text-white' : 'border border-outline text-ink-600'}`}><FolderOpen size={15} />সব</button>{folders.map((folder) => <button key={folder.id} onClick={() => setSelectedFolder(folder.id)} className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${selectedFolder === folder.id ? 'bg-brand-500 text-white' : 'border border-outline text-ink-600'}`}>{folder.name}</button>)}</div>

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-outline/40" />
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-2xl border border-outline bg-surface p-8 text-center text-ink-600">
            এই folder-এ কোনো পণ্য নেই। Product card-এর ♡ চাপুন বা অন্য folder বেছে নিন।
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{visibleProducts.map((product) => <div key={product.id} className="min-w-0"><ProductCard product={product} /><select value={folderByProduct[product.id] ?? ''} onChange={(e) => assignFolder(product.id, e.target.value)} className="mt-1 w-full rounded-lg border border-outline bg-surface px-2 py-1.5 text-xs text-ink-600 outline-none"><option value="">সব folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></div>)}</div>
        )}
      </div>
    </Layout>
  )
}
