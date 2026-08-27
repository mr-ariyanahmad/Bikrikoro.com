import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, Plus } from 'lucide-react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/Layout'
import { BrandSelect } from '@/components/BrandSelect'
import { ProductCard } from '@/components/ProductCard'
import type { Product } from '@/types/product'
import { PUBLIC_PRODUCT_FIELDS, PUBLIC_PRODUCT_TABLE } from '@/lib/publicProductFields'
import { readCachedValue, userCacheKey, writeCachedValue } from '@/lib/clientCache'

type CachedFavorites = { products: Product[]; folders: Array<{ id: string; name: string; color: string }>; folderByProduct: Record<string, string> }
const FAVORITES_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000

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
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const cacheKey = userCacheKey(uid, 'favorites')
    const cached = readCachedValue<CachedFavorites>(cacheKey, FAVORITES_CACHE_MAX_AGE_MS)
    if (cached) {
      setProducts(cached.value.products)
      setFolders(cached.value.folders)
      setFolderByProduct(cached.value.folderByProduct)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setMessage(null)
    async function load() {
      try {
        let { data: favs, error: favoritesError } = await supabase.from('favorites').select('product_id, folder_id').eq('user_id', uid)
        if (favoritesError) {
          const fallback = await supabase.from('favorites').select('product_id').eq('user_id', uid)
          if (fallback.error) throw favoritesError
          favs = (fallback.data ?? []).map((item) => ({ ...item, folder_id: null }))
        }
        const rows = favs ?? []
        const { data: folderData, error: folderError } = await supabase.from('wishlist_folders').select('id, name, color').eq('user_id', uid).order('created_at')
        if (folderError) throw folderError
        if (!active) return
        const nextFolderByProduct = Object.fromEntries(rows.map((row) => [row.product_id, row.folder_id ?? '']))
        const nextFolders = folderData ?? []
        setFolderByProduct(nextFolderByProduct)
        setFolders(nextFolders)
        const ids = rows.map((f) => f.product_id)
        if (ids.length === 0) {
          setProducts([])
          writeCachedValue(cacheKey, { products: [], folders: nextFolders, folderByProduct: nextFolderByProduct })
          return
        }
        const { data, error: productsError } = await supabase.from(PUBLIC_PRODUCT_TABLE).select(PUBLIC_PRODUCT_FIELDS).in('id', ids)
        if (productsError) throw productsError
        if (active) {
          const nextProducts = data ?? []
          setProducts(nextProducts)
          writeCachedValue(cacheKey, { products: nextProducts, folders: nextFolders, folderByProduct: nextFolderByProduct })
        }
      } catch (error) {
        console.error('Favorites load failed:', error)
        if (active) setMessage(error instanceof Error ? error.message : 'পছন্দের তালিকা লোড করা যায়নি।')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [uid])

  const createFolder = async () => {
    if (!newFolderName.trim()) return
    const { data, error } = await supabase.rpc('create_wishlist_folder', { p_user_id: uid, p_name: newFolderName.trim(), p_color: 'brand' })
    if (error || !data) {
      setMessage(error?.message ?? 'Folder তৈরি করা যায়নি।')
      return
    }
    setFolders((current) => [...current, { id: data, name: newFolderName.trim(), color: 'brand' }])
    setNewFolderName('')
    setCreatingFolder(false)
  }
  const assignFolder = async (productId: string, folderId: string) => {
    setFolderByProduct((current) => ({ ...current, [productId]: folderId }))
    const { error } = await supabase.rpc('set_favorite_folder', { p_user_id: uid, p_product_id: productId, p_folder_id: folderId || null })
    if (error) setMessage(error.message)
  }
  const visibleProducts = useMemo(() => selectedFolder === 'all' ? products : products.filter((product) => folderByProduct[product.id] === selectedFolder), [folderByProduct, products, selectedFolder])

  return (
    <Layout wide>
      <Helmet>
        <title>পছন্দের তালিকা | BikriKoro.Com</title>
      </Helmet>

      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold text-ink-900">পছন্দের তালিকা</h1><p className="mt-1 text-sm text-ink-500">পণ্যগুলো folder করে আলাদা করে রাখুন।</p></div><button type="button" onClick={() => setCreatingFolder((value) => !value)} className="inline-flex items-center gap-1.5 rounded-none border border-brand-500 px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50"><Plus size={16} />নতুন folder</button></div>
      {message && <p className="mt-4 border border-error/20 bg-error/5 p-3 text-sm text-error">{message}</p>}
      {creatingFolder && <div className="mt-4 flex gap-2 rounded-2xl border border-outline bg-surface p-3"><input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createFolder()} placeholder="যেমন: পরে কিনব" className="min-w-0 flex-1 rounded-xl border border-outline px-3 py-2 text-sm outline-none focus:border-brand-500" /><button type="button" onClick={createFolder} className="rounded-none bg-brand-500 px-3 py-2 text-sm font-semibold text-white">সেভ</button></div>}
      <div className="scrollbar-none mt-5 flex gap-2 overflow-x-auto pb-1"><button type="button" onClick={() => setSelectedFolder('all')} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold ${selectedFolder === 'all' ? 'bg-brand-500 text-white' : 'border border-outline text-ink-600'}`}><FolderOpen size={15} />সব</button>{folders.map((folder) => <button type="button" key={folder.id} onClick={() => setSelectedFolder(folder.id)} className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${selectedFolder === folder.id ? 'bg-brand-500 text-white' : 'border border-outline text-ink-600'}`}>{folder.name}</button>)}</div>

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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{visibleProducts.map((product) => <div key={product.id} className="min-w-0"><ProductCard product={product} /><div className="mt-2"><BrandSelect label="Folder" value={folderByProduct[product.id] ?? ''} options={[{ value: '', label: 'সব folder' }, ...folders.map((folder) => ({ value: folder.id, label: folder.name }))]} onChange={(value) => assignFolder(product.id, value)} /></div></div>)}</div>
        )}
      </div>
    </Layout>
  )
}
