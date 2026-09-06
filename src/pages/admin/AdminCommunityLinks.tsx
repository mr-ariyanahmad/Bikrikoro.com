import { useCallback, useEffect, useState } from 'react'
import { Edit3, ExternalLink, Globe2, MessageCircle, Plus, Send, Trash2 } from 'lucide-react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { adminRpc } from '@/lib/adminRpc'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { BrandedDialog, DialogButton } from '@/components/BrandedDialog'

type Platform = 'WHATSAPP' | 'FACEBOOK' | 'TELEGRAM' | 'OTHER'
type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
type Placement = 'HOME' | 'SEARCH' | 'SELLER_EDU' | 'SELLER_DASHBOARD'
type LinkRow = { id: string; platform: Platform; title: string; description: string; url: string; image_url: string | null; placements: string[]; status: Status; sort_order: number; updated_at: string }
type Form = { platform: Platform; title: string; description: string; url: string; image_url: string; placements: Placement[]; status: Status; sort_order: string }
const EMPTY: Form = { platform: 'WHATSAPP', title: '', description: '', url: '', image_url: '', placements: ['HOME', 'SELLER_EDU', 'SELLER_DASHBOARD'], status: 'DRAFT', sort_order: '0' }
const PLACEMENT_LABELS: Record<Placement, string> = { HOME: 'হোম পেজ', SEARCH: 'সার্চ পেজ', SELLER_EDU: 'Seller Edu Hub', SELLER_DASHBOARD: 'Seller Dashboard' }

export default function AdminCommunityLinks() {
  const { user } = useAuth()
  const [rows, setRows] = useState<LinkRow[]>([])
  const [form, setForm] = useState<Form>(EMPTY)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openForm, setOpenForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LinkRow | null>(null)

  const load = useCallback(async () => {
    if (!user?.uid) return
    setLoading(true)
    const { data, error: loadError } = await adminRpc('admin_list_community_links', { p_admin_id: user.uid })
    if (loadError) setError(formatAdminRpcError(loadError, 'কমিউনিটি লিংক লোড', '089 community links migration'))
    else setRows((data ?? []) as LinkRow[])
    setLoading(false)
  }, [user?.uid])
  useEffect(() => { void load() }, [load])

  const save = async () => {
    if (!user?.uid || !form.title.trim() || !form.url.trim()) return
    const { error: saveError } = await adminRpc('admin_upsert_community_link', { p_admin_id: user.uid, p_id: editingId, p_platform: form.platform, p_title: form.title.trim(), p_description: form.description.trim(), p_url: form.url.trim(), p_image_url: form.image_url.trim() || null, p_placements: form.placements, p_status: form.status, p_sort_order: Number(form.sort_order || 0) })
    if (saveError) setError(formatAdminRpcError(saveError, 'কমিউনিটি লিংক সেভ', '089 community links migration'))
    else { setOpenForm(false); setEditingId(null); setForm(EMPTY); await load() }
  }
  const startEdit = (row: LinkRow) => { setEditingId(row.id); setForm({ platform: row.platform, title: row.title, description: row.description, url: row.url, image_url: row.image_url ?? '', placements: row.placements.filter((value): value is Placement => value in PLACEMENT_LABELS), status: row.status, sort_order: String(row.sort_order) }); setOpenForm(true) }
  const remove = async () => { if (!user?.uid || !deleteTarget) return; const { error: removeError } = await adminRpc('admin_delete_community_link', { p_admin_id: user.uid, p_id: deleteTarget.id }); if (removeError) setError(formatAdminRpcError(removeError, 'কমিউনিটি লিংক মুছুন', '089 community links migration')); else { setDeleteTarget(null); await load() } }
  const togglePlacement = (placement: Placement) => setForm((current) => ({ ...current, placements: current.placements.includes(placement) ? current.placements.filter((value) => value !== placement) : [...current.placements, placement] }))

  return <AdminShell><AdminPageHeader title="কমিউনিটি লিংক" description="Facebook, WhatsApp ও অন্যান্য community link এক জায়গা থেকে publish করুন এবং কোন কোন জায়গায় দেখাবে তা নির্ধারণ করুন।" actions={<button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); setOpenForm((value) => !value) }} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />নতুন লিংক</button>} />
    {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {openForm && <AdminTableCard className="mb-5"><div className="grid gap-3 p-5 md:grid-cols-2"><Field label="Platform" value={form.platform} onChange={(value) => setForm({ ...form, platform: value as Platform })} options={['WHATSAPP', 'FACEBOOK', 'TELEGRAM', 'OTHER']} /><Field label="Title" value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="BikriKoro Seller WhatsApp Group" /><Field label="URL" value={form.url} onChange={(value) => setForm({ ...form, url: value })} placeholder="https://chat.whatsapp.com/..." /><Field label="Image URL (optional)" value={form.image_url} onChange={(value) => setForm({ ...form, image_url: value })} placeholder="https://..." /><label className="md:col-span-2"><span className="mb-1 block text-sm font-semibold text-slate-700">Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" /></label><label><span className="mb-1 block text-sm font-semibold text-slate-700">Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })} className="w-full border border-slate-200 px-3 py-2.5"><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label><Field label="Sort order" value={form.sort_order} onChange={(value) => setForm({ ...form, sort_order: value })} placeholder="0" /><div className="md:col-span-2"><p className="mb-2 text-sm font-semibold text-slate-700">কোথায় দেখাবে</p><div className="flex flex-wrap gap-2">{(Object.keys(PLACEMENT_LABELS) as Placement[]).map((placement) => <label key={placement} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={form.placements.includes(placement)} onChange={() => togglePlacement(placement)} />{PLACEMENT_LABELS[placement]}</label>)}</div></div><div className="md:col-span-2 flex gap-2"><button type="button" onClick={() => void save()} className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white">{editingId ? 'পরিবর্তন সেভ করুন' : 'লিংক সেভ করুন'}</button><button type="button" onClick={() => setOpenForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">বাতিল</button></div></div></AdminTableCard>}
    <AdminTableCard>{loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : rows.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">এখনো কোনো community link নেই।</p> : <div className="divide-y divide-slate-100">{rows.map((row) => { const Icon = row.platform === 'WHATSAPP' ? MessageCircle : row.platform === 'FACEBOOK' ? Globe2 : row.platform === 'TELEGRAM' ? Send : ExternalLink; return <div key={row.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon size={19} /></span><div className="min-w-0"><p className="font-semibold text-slate-900">{row.title}</p><p className="mt-1 truncate text-xs text-slate-500">{row.platform} · {row.placements.join(', ')} · {row.status}</p></div></div><div className="flex flex-wrap gap-2"><a href={row.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600"><ExternalLink size={13} />খুলুন</a><button type="button" onClick={() => startEdit(row)} className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700"><Edit3 size={13} />এডিট</button><button type="button" onClick={() => setDeleteTarget(row)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"><Trash2 size={13} />মুছুন</button></div></div> })}</div>}</AdminTableCard>
    <BrandedDialog open={Boolean(deleteTarget)} title="Community link মুছবেন?" tone="danger" onClose={() => setDeleteTarget(null)} actions={<><DialogButton onClick={() => setDeleteTarget(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={() => void remove()} tone="danger">মুছুন</DialogButton></>}><p>এই link সব public placement থেকে সরিয়ে দেওয়া হবে।</p></BrandedDialog>
  </AdminShell>
}

function Field({ label, value, onChange, placeholder = '', options }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; options?: string[] }) { return <label><span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>{options ? <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-slate-200 px-3 py-2.5">{options.map((option) => <option key={option}>{option}</option>)}</select> : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" />}</label> }
