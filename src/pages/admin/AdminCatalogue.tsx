import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckSquare, Edit3, Eye, EyeOff, Plus, RotateCcw, Save, Square, Tags, Trash2 } from 'lucide-react'
import { AdminPageHeader, AdminShell, AdminTableCard } from '@/components/admin/AdminShell'
import { useAuth } from '@/context/AuthContext'
import { formatTaka } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { formatAdminRpcError } from '@/lib/adminRpcError'
import { BrandedDialog, DialogButton, DialogInput } from '@/components/BrandedDialog'
import { BrandSelect } from '@/components/BrandSelect'
import type { Category, DigitalCategoryTemplate, DigitalSpecField, Product } from '@/types/product'
import { adminRpc } from '@/lib/adminRpc'
import { getProductQuality } from '@/lib/adminProductQuality'

type Mode = 'products' | 'categories' | 'industries'
type AdminProduct = Product & { is_hidden?: boolean; archived_at?: string | null; moderation_note?: string | null; approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED'; approval_note?: string; approval_reviewed_by?: string | null; approval_reviewed_email?: string | null; approval_reviewed_at?: string | null }
type ProductView = 'PENDING' | 'LIVE' | 'REJECTED' | 'QUALITY'
type ApprovalHistory = { id: string; product_id: string; admin_uid: string; admin_email: string; admin_name: string; decision: 'APPROVED' | 'REJECTED'; note: string; created_at: string }
type ProductDraft = { title: string; description: string; price: string; category_id: string; condition: 'NEW' | 'USED'; images: string }
type TemplateDraft = { category_id: string; name_bn: string; name_en: string; description_bn: string; icon_key: string; sort_order: string; is_active: boolean; fields: DigitalSpecField[] }

export default function AdminCatalogue({ mode = 'products' }: { mode?: Mode }) {
  const { user } = useAuth()
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [templates, setTemplates] = useState<DigitalCategoryTemplate[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminProduct | null>(null)
  const [draft, setDraft] = useState<ProductDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [moderationTarget, setModerationTarget] = useState<{ product: AdminProduct; action: 'HIDE' | 'RESTORE' | 'DELETE' } | null>(null)
  const [approvalTarget, setApprovalTarget] = useState<{ product: AdminProduct; status: 'APPROVED' | 'REJECTED'; note: string } | null>(null)
  const [historyTarget, setHistoryTarget] = useState<AdminProduct | null>(null)
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [categoryPrompt, setCategoryPrompt] = useState<{ category: Category | null; value: string } | null>(null)
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null)
  const [productView, setProductView] = useState<ProductView>('PENDING')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<'APPROVE' | 'REJECT' | 'HIDE' | 'RESTORE' | 'DELETE'>('APPROVE')
  const [bulkWorking, setBulkWorking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSelectedIds([])
    if (mode === 'products') {
      setProducts([])
      if (!user?.uid) {
        setError('আপনার login session এখনো প্রস্তুত নয়। আবার login করে চেষ্টা করুন।')
        setProducts([])
        setLoading(false)
        return
      }
      const { data, error: loadError } = await adminRpc('admin_list_products', { p_admin_id: user.uid })
      setProducts(normalizeAdminProducts(data))
      if (loadError) setError(formatAdminRpcError(loadError, 'প্রোডাক্ট data', '014 admin workspace migration'))
    } else {
      setCategories([])
      setTemplates([])
      const [{ data, error: loadError }, templateResult] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        user?.uid ? adminRpc('admin_list_digital_category_templates', { p_admin_id: user.uid }) : Promise.resolve({ data: [], error: null }),
      ])
      const categoryRows = (data ?? []) as Category[]
      setCategories(categoryRows)
      const categoryNames = new Map(categoryRows.map((category) => [category.id, category.name]))
      setTemplates(((templateResult.data ?? []) as Array<Omit<DigitalCategoryTemplate, 'name_bn'>>).map((template) => ({ ...template, name_bn: categoryNames.get(template.category_id) ?? template.category_id })))
      if (loadError) setError('ক্যাটাগরি লোড করা যায়নি।')
      if (templateResult.error) setError(formatAdminRpcError(templateResult.error, 'ডিজিটাল template', '050 digital listing migration'))
    }
    setLoading(false)
  }, [mode, user?.uid])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    const byView = products.filter((product) => {
      if (productView === 'PENDING') return product.approval_status !== 'APPROVED' && product.approval_status !== 'REJECTED' && !product.archived_at && product.moderation_note !== 'DELETE'
      if (productView === 'LIVE') return product.approval_status === 'APPROVED' && !product.is_hidden && !product.archived_at
      if (productView === 'REJECTED') return product.approval_status === 'REJECTED'
      if (productView === 'QUALITY') return getProductQuality(product).score < 55 && !product.archived_at
      return false
    })
    return value ? byView.filter((product) => `${product.title} ${product.description} ${product.location} ${product.category_id}`.toLowerCase().includes(value)) : byView
  }, [products, productView, query])

  const viewCounts = useMemo(() => ({
    PENDING: products.filter((product) => product.approval_status !== 'APPROVED' && product.approval_status !== 'REJECTED' && !product.archived_at && product.moderation_note !== 'DELETE').length,
    LIVE: products.filter((product) => product.approval_status === 'APPROVED' && !product.is_hidden && !product.archived_at).length,
    REJECTED: products.filter((product) => product.approval_status === 'REJECTED').length,
    QUALITY: products.filter((product) => getProductQuality(product).score < 55 && !product.archived_at).length,
  }), [products])

  const toggleSelected = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  const visibleIds = filtered.map((product) => product.id)
  const toggleAll = () => setSelectedIds((current) => {
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => current.includes(id))
    return allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds]))
  })
  const runBulkAction = async () => {
    if (!user?.uid || selectedIds.length === 0) return
    if ((bulkAction === 'DELETE' || bulkAction === 'REJECT') && !window.confirm(`${selectedIds.length}টি product-এ এই action প্রয়োগ করবেন?`)) return
    setBulkWorking(true)
    const { error: bulkError } = await adminRpc('admin_bulk_product_action', { p_admin_id: user.uid, p_product_ids: selectedIds, p_action: bulkAction, p_admin_note: '' })
    setBulkWorking(false)
    if (bulkError) setError(formatAdminRpcError(bulkError, 'Bulk product action', '108 admin bulk product actions migration'))
    else { setSelectedIds([]); await load() }
  }

  const openEditor = (product: AdminProduct) => {
    setEditing(product)
    setDraft({ title: product.title, description: product.description, price: String(product.price), category_id: product.category_id, condition: product.condition, images: product.images.join('\n') })
  }

  const saveProduct = async () => {
    if (!editing || !draft || !draft.title.trim() || Number(draft.price) <= 0) return
    setSaving(true)
    const { error: saveError } = await adminRpc('admin_update_product', {
      p_admin_id: user?.uid,
      p_product_id: editing.id,
      p_title: draft.title.trim(),
      p_description: draft.description.trim(),
      p_price: Number(draft.price),
      p_category_id: draft.category_id,
      p_condition: draft.condition,
      p_location: '',
      p_images: draft.images.split('\n').map((value) => value.trim()).filter(Boolean),
    })
    setSaving(false)
    if (saveError) { setError(formatAdminRpcError(saveError, 'প্রোডাক্ট update', '014 admin workspace migration')); return }
    setEditing(null); setDraft(null); load()
  }

  const moderate = async (product: AdminProduct, action: 'HIDE' | 'RESTORE' | 'DELETE') => {
    const { error: actionError } = await adminRpc('admin_moderate_product', { p_admin_id: user?.uid, p_product_id: product.id, p_action: action })
    if (actionError) setError('প্রোডাক্ট action সম্পন্ন হয়নি।')
    else load()
    setModerationTarget(null)
  }

  const reviewProduct = async () => {
    if (!approvalTarget || !user?.uid) return
    const { error: reviewError } = await adminRpc('admin_review_product', { p_admin_id: user.uid, p_product_id: approvalTarget.product.id, p_status: approvalTarget.status, p_admin_note: approvalTarget.note.trim() })
    if (reviewError) setError(reviewError.message.includes('permission') ? 'আপনার product approval permission নেই।' : 'প্রোডাক্ট approval সম্পন্ন করা যায়নি।')
    else { setApprovalTarget(null); await load() }
  }

  const openApprovalHistory = async (product: AdminProduct) => {
    setHistoryTarget(product)
    setHistoryLoading(true)
    const { data, error: historyError } = await adminRpc('admin_list_product_approval_history', { p_admin_id: user?.uid, p_product_id: product.id })
    setApprovalHistory((data ?? []) as ApprovalHistory[])
    if (historyError) setError(formatAdminRpcError(historyError, 'Approval history', '031 admin approval migration'))
    setHistoryLoading(false)
  }

  const addCategory = () => setCategoryPrompt({ category: null, value: '' })
  const openTemplate = (category: Category, template?: DigitalCategoryTemplate) => setTemplateDraft(template ? { category_id: template.category_id, name_bn: category.name, name_en: template.name_en, description_bn: template.description_bn, icon_key: template.icon_key, sort_order: String(template.sort_order), is_active: template.is_active, fields: template.fields } : { category_id: category.id, name_bn: category.name, name_en: '', description_bn: '', icon_key: 'Package', sort_order: String(category.sort_order), is_active: true, fields: [] })
  const addTemplateField = () => setTemplateDraft((current) => current ? { ...current, fields: [...current.fields, { key: `field_${current.fields.length + 1}`, label_bn: '', label_en: '', type: 'text', required: false, options: [] }] } : current)
  const updateTemplateField = (index: number, patch: Partial<DigitalSpecField>) => setTemplateDraft((current) => current ? { ...current, fields: current.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...patch } : field) } : current)
  const removeTemplateField = (index: number) => setTemplateDraft((current) => current ? { ...current, fields: current.fields.filter((_, fieldIndex) => fieldIndex !== index) } : current)
  const saveTemplate = async () => {
    if (!templateDraft || !user?.uid || !templateDraft.name_bn.trim()) return
    const fields = templateDraft.fields.filter((field) => field.key.trim() && field.label_bn.trim()).map((field) => ({ ...field, key: field.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'), label_bn: field.label_bn.trim(), label_en: field.label_en?.trim() || '', options: field.options?.filter(Boolean) ?? [] }))
    const { error: templateError } = await adminRpc('admin_upsert_digital_category_template', { p_admin_id: user.uid, p_category_id: templateDraft.category_id, p_name_bn: templateDraft.name_bn.trim(), p_name_en: templateDraft.name_en.trim(), p_description_bn: templateDraft.description_bn.trim(), p_icon_key: templateDraft.icon_key.trim() || 'Package', p_fields: fields, p_sort_order: Number(templateDraft.sort_order || 0), p_is_active: templateDraft.is_active })
    if (templateError) setError(formatAdminRpcError(templateError, 'ডিজিটাল category template', '050 digital listing migration'))
    else { setTemplateDraft(null); await load() }
  }
  const renameCategory = (category: Category) => setCategoryPrompt({ category, value: category.name })
  const saveCategoryPrompt = async () => {
    if (!categoryPrompt?.value.trim()) return
    const name = categoryPrompt.value.trim()
    const id = categoryPrompt.category?.id ?? `cat_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now().toString(36)}`
    if (categoryPrompt.category && name === categoryPrompt.category.name) { setCategoryPrompt(null); return }
    const { error: categoryError } = await adminRpc('admin_upsert_category', { p_admin_id: user?.uid, p_id: id, p_name: name, p_sort_order: categoryPrompt.category?.sort_order ?? categories.length + 1 })
    if (categoryError) setError(categoryPrompt.category ? 'ক্যাটাগরি আপডেট করা যায়নি।' : 'ক্যাটাগরি যোগ করা যায়নি।')
    else { setCategoryPrompt(null); load() }
  }

  const title = mode === 'products' ? 'প্রোডাক্ট' : mode === 'categories' ? 'ক্যাটাগরি' : 'ইন্ডাস্ট্রি'
  return (
    <AdminShell>
      <AdminPageHeader title={title} description={mode === 'products' ? 'প্রোডাক্ট Pending, Live এবং Rejected—এই তিনটি status থেকে review ও management করুন।' : mode === 'categories' ? 'প্রোডাক্ট taxonomy ও category name/order ম্যানেজ করুন।' : 'ভবিষ্যৎ industry taxonomy-এর জন্য app-native grouping।'} actions={mode === 'categories' ? <button type="button" onClick={addCategory} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} />নতুন category</button> : undefined} />
      {error && <p className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {mode === 'products' ? <>
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 sm:grid-cols-4">{([['PENDING', 'Pending'], ['LIVE', 'Live'], ['REJECTED', 'Rejected'], ['QUALITY', 'Quality দরকার']] as Array<[ProductView, string]>).map(([value, label]) => <button key={value} type="button" onClick={() => { setProductView(value); setSelectedIds([]) }} className={`rounded-xl px-3 py-2.5 text-sm font-bold transition ${productView === value ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}>{label} <span className="ml-1 opacity-80">{viewCounts[value]}</span></button>)}</div>
        <div className="mb-5 flex flex-col gap-3"><div className="flex flex-col gap-3 sm:flex-row"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title, description বা category খুঁজুন..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500" /><span className="flex items-center rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-500">{filtered.length.toLocaleString('bn-BD')}টি listing</span></div>{selectedIds.length > 0 && <div className="flex flex-col gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-3 sm:flex-row sm:items-center"><span className="text-sm font-bold text-brand-800">{selectedIds.length}টি selected</span><select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as typeof bulkAction)} className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><option value="APPROVE">Approve / Live</option><option value="REJECT">Reject</option></select><button type="button" disabled={bulkWorking} onClick={() => void runBulkAction()} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{bulkWorking ? 'চলছে...' : bulkAction === 'REJECT' ? 'সব Reject করুন' : 'সব Live করুন'}</button></div>}</div>
        <AdminTableCard>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[auto_1.7fr_0.8fr_0.7fr_0.8fr_1fr] md:gap-4"><button type="button" onClick={toggleAll} aria-label="দেখানো সব product select করুন" className="inline-flex items-center gap-2 text-brand-700"><span>{visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id)) ? <CheckSquare size={17} /> : <Square size={17} />}</span><span className="normal-case md:hidden">সব select</span></button><span className="hidden md:block">Listing</span><span className="hidden md:block">দাম</span><span className="hidden md:block">ধরন</span><span className="hidden md:block">ভিজিবিলিটি</span><span className="hidden md:block">Control</span></div>
          {loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : filtered.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো প্রোডাক্ট পাওয়া যায়নি।</p> : <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((product) => <div key={product.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-md"><button type="button" onClick={() => toggleSelected(product.id)} aria-label={`${product.title} select করুন`} className="inline-flex w-fit items-center gap-2 text-brand-700 md:block">{selectedIds.includes(product.id) ? <CheckSquare size={18} /> : <Square size={18} />}<span className="text-xs font-semibold md:hidden">Select</span></button><div className="flex min-w-0 items-center gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100">{product.images[0] && <img src={product.images[0]} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0"><p className="truncate font-semibold text-slate-800">{product.title}</p><p className="mt-1 truncate text-xs text-slate-400">{product.category_id} · {product.view_count} views · {product.is_digital ? 'ডিজিটাল' : 'পুরনো রেকর্ড'}</p><span className={`mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${product.approval_status === 'APPROVED' ? 'bg-brand-50 text-brand-700' : product.approval_status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{product.approval_status === 'APPROVED' ? `এডমিন অনুমোদিত${product.approval_reviewed_email ? ` · ${product.approval_reviewed_email}` : product.approval_reviewed_by ? ` · ${product.approval_reviewed_by}` : ''}` : product.approval_status === 'REJECTED' ? 'এডমিন বাতিল করেছে' : 'অনুমোদন বাকি'}</span></div></div><p className="font-semibold text-brand-700">{formatTaka(product.price)}</p><p className="text-sm text-slate-600">{product.condition === 'NEW' ? 'নতুন' : 'ব্যবহৃত'}</p><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${product.is_hidden ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-700'}`}>{product.is_hidden ? 'অপ্রকাশিত' : 'লাইভ'}</span><div className="flex flex-wrap gap-2">{product.is_digital && product.approval_status !== 'APPROVED' && <button type="button" title="Approve digital product" onClick={() => setApprovalTarget({ product, status: 'APPROVED', note: '' })} className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600">অনুমোদন</button>}{product.is_digital && product.approval_status !== 'REJECTED' && <button type="button" title="Reject digital product" onClick={() => setApprovalTarget({ product, status: 'REJECTED', note: '' })} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:border-red-400">বাতিল</button>}<button type="button" title="Approval history" onClick={() => void openApprovalHistory(product)} className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-400">ইতিহাস</button>{product.is_digital && <><button type="button" title="Edit digital listing" onClick={() => openEditor(product)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700"><Edit3 size={14} />Edit</button>{product.is_hidden ? <button type="button" title="Restore digital listing" onClick={() => setModerationTarget({ product, action: 'RESTORE' })} className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2.5 py-1.5 text-xs font-semibold text-brand-700"><RotateCcw size={14} />Restore</button> : <button type="button" title="Hide digital listing" onClick={() => setModerationTarget({ product, action: 'HIDE' })} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-xs font-semibold text-amber-700"><EyeOff size={14} />Hide</button>}</>}{product.is_digital && <button type="button" title="Archive digital listing" onClick={() => setModerationTarget({ product, action: 'DELETE' })} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"><Trash2 size={14} />Archive</button>} {!product.is_digital && <span className="px-2.5 py-1.5 text-xs font-semibold text-slate-500">পুরনো record archive</span>}</div></div>)}</div>}
        </AdminTableCard>
      </> : mode === 'categories' ? <><AdminTableCard><div className="divide-y divide-slate-100">{loading ? <p className="p-10 text-center text-sm text-slate-500">লোড হচ্ছে...</p> : categories.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">কোনো category নেই।</p> : categories.map((category) => <div key={category.id} className="flex items-center justify-between gap-3 px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="rounded-xl bg-brand-50 p-2 text-brand-700"><Tags size={16} /></span><div><p className="font-semibold text-slate-800">{category.name}</p><p className="mt-1 text-xs text-slate-400">{category.id} · Sort {category.sort_order}</p></div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => renameCategory(category)} className="inline-flex items-center gap-1 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-brand-400 hover:text-brand-700"><Edit3 size={14} />নাম বদলান</button><button type="button" onClick={() => openTemplate(category, templates.find((item) => item.category_id === category.id))} className="inline-flex items-center gap-1 border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:border-brand-400"><Edit3 size={14} />{templates.some((item) => item.category_id === category.id) ? 'Fields edit' : 'Template তৈরি'}</button></div></div>)}</div></AdminTableCard><AdminTableCard><div className="border-b border-slate-200 px-5 py-4"><p className="font-semibold text-slate-800">Digital category templates</p><p className="mt-1 text-xs leading-5 text-slate-500">Seller form-এর category-specific options এখান থেকে admin configure করবে।</p></div><div className="divide-y divide-slate-100">{templates.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">এখনো কোনো digital template নেই।</p> : templates.map((template) => <div key={template.category_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-semibold text-slate-800">{template.name_bn}</p><p className="mt-1 text-xs text-slate-500">{template.category_id} · {template.fields.length}টি field · {template.is_active ? 'সক্রিয়' : 'বন্ধ'}</p></div><button type="button" onClick={() => { const category = categories.find((item) => item.id === template.category_id); if (category) openTemplate(category, template) }} className="border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700">Template edit</button></div>)}</div></AdminTableCard></> : <AdminTableCard><div className="p-10 text-center"><FactoryIcon /><p className="mt-3 font-semibold text-slate-800">Industry taxonomy এখনো configure করা হয়নি</p><p className="mt-1 text-sm text-slate-500">BikriKoro-এর business category চূড়ান্ত হলে এখানে grouping যোগ করা যাবে।</p></div></AdminTableCard>}
      <BrandedDialog open={Boolean(approvalTarget)} title={approvalTarget?.status === 'APPROVED' ? 'প্রোডাক্ট অনুমোদন করবেন?' : 'প্রোডাক্ট বাতিল করবেন?'} tone={approvalTarget?.status === 'APPROVED' ? 'success' : 'danger'} onClose={() => setApprovalTarget(null)} actions={<><DialogButton onClick={() => setApprovalTarget(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={reviewProduct} tone={approvalTarget?.status === 'APPROVED' ? 'success' : 'danger'}>নিশ্চিত করুন</DialogButton></>}><p><strong>{approvalTarget?.product.title}</strong> — এই সিদ্ধান্ত seller ও audit history-তে সংরক্ষিত হবে।</p><DialogInput value={approvalTarget?.note ?? ''} onChange={(value) => setApprovalTarget((current) => current ? { ...current, note: value } : current)} placeholder="Admin note (ঐচ্ছিক)" /></BrandedDialog><BrandedDialog open={Boolean(historyTarget)} title="প্রোডাক্ট অনুমোদনের ইতিহাস" onClose={() => setHistoryTarget(null)} actions={<DialogButton onClick={() => setHistoryTarget(null)}>বন্ধ করুন</DialogButton>}><p className="mb-3">{historyTarget?.title}</p>{historyLoading ? <p>ইতিহাস লোড হচ্ছে...</p> : approvalHistory.length === 0 ? <p>এখনো কোনো অনুমোদনের ইতিহাস নেই।</p> : <div className="max-h-72 space-y-2 overflow-y-auto">{approvalHistory.map((entry) => <div key={entry.id} className="rounded-xl border border-outline bg-bg p-3"><div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${entry.decision === 'APPROVED' ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'}`}>{entry.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED'}</span><span className="text-[11px] text-ink-400">{new Date(entry.created_at).toLocaleString('bn-BD')}</span></div><p className="mt-2 text-xs text-ink-600">অ্যাডমিন: {entry.admin_email || 'ইমেইল নেই'}</p><p className="break-all text-[11px] text-ink-400">UID: {entry.admin_uid}</p>{entry.note && <p className="mt-1 text-xs text-ink-600">নোট: {entry.note}</p>}</div>)}</div>}</BrandedDialog><BrandedDialog open={Boolean(moderationTarget)} title={moderationTarget?.action === 'RESTORE' ? 'Listing আবার প্রকাশ করবেন?' : moderationTarget?.action === 'DELETE' ? 'Listing archive করবেন?' : 'Listing লুকাবেন?'} tone={moderationTarget?.action === 'RESTORE' ? 'brand' : 'warning'} onClose={() => setModerationTarget(null)} actions={<><DialogButton onClick={() => setModerationTarget(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={() => moderationTarget && moderate(moderationTarget.product, moderationTarget.action)} tone={moderationTarget?.action === 'RESTORE' ? 'brand' : 'warning'}>নিশ্চিত করুন</DialogButton></>}><p>এই action-এর পরে product visibility পরিবর্তন হবে এবং admin audit log-এ রাখা হবে।</p></BrandedDialog><BrandedDialog open={Boolean(categoryPrompt)} title={categoryPrompt?.category ? 'Category-এর নাম বদলান' : 'নতুন category'} onClose={() => setCategoryPrompt(null)} actions={<><DialogButton onClick={() => setCategoryPrompt(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={saveCategoryPrompt}>সেভ করুন</DialogButton></>}><p>বাংলায় সহজে বোঝা যায় এমন একটি category নাম লিখুন।</p><DialogInput value={categoryPrompt?.value ?? ''} onChange={(value) => setCategoryPrompt((current) => current ? { ...current, value } : current)} placeholder="যেমন: মোবাইল" /></BrandedDialog><BrandedDialog open={Boolean(templateDraft)} title="Digital category template" onClose={() => setTemplateDraft(null)} actions={<><DialogButton onClick={() => setTemplateDraft(null)} variant="outline">বাতিল</DialogButton><DialogButton onClick={saveTemplate}>Template সেভ করুন</DialogButton></>}><p className="text-sm text-ink-600">Seller form-এ এই category বেছে নিলে নিচের fieldগুলো দেখা যাবে। Field key ইংরেজি অক্ষর ও underscore-এ রাখুন।</p>{templateDraft && <div className="mt-4 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><DialogInput value={templateDraft.name_bn} onChange={(value) => setTemplateDraft((current) => current ? { ...current, name_bn: value } : current)} placeholder="বাংলা category name" /><DialogInput value={templateDraft.name_en} onChange={(value) => setTemplateDraft((current) => current ? { ...current, name_en: value } : current)} placeholder="English category name" /></div><label className="block text-sm text-ink-700"><span className="mb-1 block font-medium text-ink-900">Category description</span><textarea value={templateDraft.description_bn} onChange={(event) => setTemplateDraft({ ...templateDraft, description_bn: event.target.value })} rows={2} className="w-full border border-outline px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label><div className="grid gap-3 sm:grid-cols-3"><DialogInput value={templateDraft.icon_key} onChange={(value) => setTemplateDraft((current) => current ? { ...current, icon_key: value } : current)} placeholder="Icon key" /><DialogInput value={templateDraft.sort_order} onChange={(value) => setTemplateDraft((current) => current ? { ...current, sort_order: value } : current)} placeholder="Sort order" /><button type="button" onClick={() => setTemplateDraft({ ...templateDraft, is_active: !templateDraft.is_active })} className={`border px-3 py-2 text-sm font-semibold ${templateDraft.is_active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline text-ink-600'}`}>Template {templateDraft.is_active ? 'চালু' : 'বন্ধ'}</button></div><div className="border-t border-outline pt-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold text-ink-900">Specification fields</p><button type="button" onClick={addTemplateField} className="border border-brand-200 px-3 py-1.5 text-sm font-semibold text-brand-700">+ Field যোগ করুন</button></div><div className="mt-3 space-y-3">{templateDraft.fields.map((field, index) => <div key={`${field.key}-${index}`} className="border border-outline p-3"><div className="grid gap-2 sm:grid-cols-2"><input value={field.key} onChange={(event) => updateTemplateField(index, { key: event.target.value })} placeholder="field_key" className="border border-outline px-3 py-2 text-sm outline-none focus:border-brand-500" /><input value={field.label_bn} onChange={(event) => updateTemplateField(index, { label_bn: event.target.value })} placeholder="বাংলা label" className="border border-outline px-3 py-2 text-sm outline-none focus:border-brand-500" /><BrandSelect label="Field type" value={field.type} options={[{ value: 'text', label: 'Text' }, { value: 'textarea', label: 'Textarea' }, { value: 'number', label: 'Number' }, { value: 'select', label: 'Select' }, { value: 'boolean', label: 'Yes/No' }]} onChange={(value) => updateTemplateField(index, { type: value as DigitalSpecField['type'] })} /><button type="button" onClick={() => updateTemplateField(index, { required: !field.required })} className={`border px-3 py-2 text-sm font-semibold ${field.required ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-outline text-ink-600'}`}>{field.required ? 'Required' : 'Optional'}</button></div>{field.type === 'select' && <input value={(field.options ?? []).join(', ')} onChange={(event) => updateTemplateField(index, { options: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} placeholder="Options comma দিয়ে লিখুন" className="mt-2 w-full border border-outline px-3 py-2 text-sm outline-none focus:border-brand-500" />}<button type="button" onClick={() => removeTemplateField(index)} className="mt-2 inline-flex items-center gap-1 border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700"><Trash2 size={13} />Field বাদ দিন</button></div>)}</div></div></div>}</BrandedDialog>{editing && draft && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-bold text-slate-900">Listing edit করুন</h2><p className="mt-1 text-xs text-slate-500">{editing.id}</p></div><button type="button" onClick={() => { setEditing(null); setDraft(null) }} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-500">বন্ধ</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Input label="Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} /><Input label="Price" type="number" value={draft.price} onChange={(value) => setDraft({ ...draft, price: value })} /><Input label="Category ID" value={draft.category_id} onChange={(value) => setDraft({ ...draft, category_id: value })} /><BrandSelect label="Condition" value={draft.condition} options={[{ value: 'NEW', label: 'নতুন' }, { value: 'USED', label: 'ব্যবহৃত' }]} onChange={(value) => setDraft({ ...draft, condition: value as 'NEW' | 'USED' })} /><Input label="Image URLs (প্রতি লাইনে একটি)" value={draft.images} onChange={(value) => setDraft({ ...draft, images: value })} /></div><label className="mt-4 block text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">Description</span><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={5} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" /></label><button type="button" onClick={saveProduct} disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{saving ? 'সেভ হচ্ছে...' : 'Listing save করুন'}</button></div></div>}
    </AdminShell>
  )
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="text-sm text-slate-600"><span className="mb-1 block font-medium text-slate-800">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-brand-500" /></label> }
function FactoryIcon() { return <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Eye size={22} /></span> }

function normalizeAdminProducts(rows: unknown): AdminProduct[] {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => {
    const product = (row ?? {}) as Partial<AdminProduct>
    return {
      ...product,
      id: String(product.id ?? ''),
      title: String(product.title ?? ''),
      description: String(product.description ?? ''),
      price: Number(product.price ?? 0),
      original_price: product.original_price == null ? null : Number(product.original_price),
      images: Array.isArray(product.images) ? product.images.filter((image): image is string => typeof image === 'string') : [],
      category_id: String(product.category_id ?? ''),
      condition: product.condition === 'USED' ? 'USED' : 'NEW',
      location: String(product.location ?? ''),
      seller_id: String(product.seller_id ?? ''),
      view_count: Number(product.view_count ?? 0),
      is_digital: product.is_digital !== false,
      is_escrow_protected: product.is_escrow_protected !== false,
    } as AdminProduct
  })
}
