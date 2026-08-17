import { useEffect, useState } from 'react'
import { Bookmark, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Layout } from '@/components/Layout'

type SavedSearch = { label: string; url: string }
const KEY = 'bikrikoro:saved-searches'

export default function SavedSearches() {
  const [items, setItems] = useState<SavedSearch[]>([])
  useEffect(() => { try { setItems(JSON.parse(localStorage.getItem(KEY) ?? '[]')) } catch { setItems([]) } }, [])
  const remove = (url: string) => { const next = items.filter((item) => item.url !== url); setItems(next); localStorage.setItem(KEY, JSON.stringify(next)) }
  const clear = () => { setItems([]); localStorage.removeItem(KEY) }

  return <Layout wide><Helmet><title>সেভড সার্চ | BikriKoro.Com</title></Helmet><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold text-ink-900">সেভড সার্চ</h1><p className="mt-1 text-sm text-ink-500">আপনার পছন্দের filter link এক জায়গায় রাখুন।</p></div>{items.length > 0 && <button onClick={clear} className="inline-flex items-center gap-1.5 rounded-xl border border-outline px-3 py-2 text-sm font-semibold text-error hover:bg-error/5"><Trash2 size={15} />সব মুছুন</button>}</div>{items.length === 0 ? <div className="mt-8 rounded-2xl border border-outline bg-surface p-8 text-center"><Bookmark size={28} className="mx-auto text-ink-300" /><p className="mt-3 font-semibold text-ink-800">কোনো saved search নেই</p><p className="mt-1 text-sm text-ink-500">Products পেজে search/filter করে “সার্চ সেভ” চাপুন।</p><Link to="/products" className="mt-4 inline-block rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">পণ্য ব্রাউজ করুন</Link></div> : <div className="mt-6 space-y-3">{items.map((item) => <div key={item.url} className="flex items-center gap-3 rounded-2xl border border-outline bg-surface p-4"><Bookmark size={18} className="shrink-0 text-brand-600" /><div className="min-w-0 flex-1"><p className="font-semibold text-ink-900">{item.label}</p><p className="truncate text-xs text-ink-400">{item.url}</p></div><Link to={item.url} className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">দেখুন</Link><button onClick={() => remove(item.url)} className="rounded-xl p-2 text-ink-400 hover:bg-error/5 hover:text-error" aria-label="সেভড সার্চ মুছুন"><Trash2 size={16} /></button></div>)}</div>}</Layout>
}
