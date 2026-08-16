import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/Layout'

export default function AdminDashboard() {
  const [pendingDisputes, setPendingDisputes] = useState(0)
  const [pendingRegistrations, setPendingRegistrations] = useState(0)

  useEffect(() => {
    async function load() {
      const [disputesRes, registrationsRes] = await Promise.all([
        supabase.from('order_disputes').select('id', { count: 'exact', head: true }).in('status', ['REPORTED', 'UNDER_REVIEW']),
        supabase.from('seller_registrations').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      ])
      setPendingDisputes(disputesRes.count ?? 0)
      setPendingRegistrations(registrationsRes.count ?? 0)
    }
    load()
  }, [])

  return (
    <Layout>
      <h1 className="text-xl font-semibold text-ink-900">অ্যাডমিন প্যানেল</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          to="/admin/disputes"
          className="rounded-2xl border border-outline bg-surface p-5 hover:border-brand-500/40"
        >
          <p className="text-sm font-medium text-ink-600">রিপোর্ট রিভিউ</p>
          <p className="tabular-amount mt-1 text-3xl font-bold text-brand-600">{pendingDisputes}</p>
          <p className="mt-1 text-xs text-ink-300">পর্যালোচনার অপেক্ষায়</p>
        </Link>

        <Link
          to="/admin/sellers"
          className="rounded-2xl border border-outline bg-surface p-5 hover:border-brand-500/40"
        >
          <p className="text-sm font-medium text-ink-600">সেলার ভেরিফিকেশন</p>
          <p className="tabular-amount mt-1 text-3xl font-bold text-brand-600">{pendingRegistrations}</p>
          <p className="mt-1 text-xs text-ink-300">অনুমোদনের অপেক্ষায়</p>
        </Link>
      </div>
    </Layout>
  )
}
