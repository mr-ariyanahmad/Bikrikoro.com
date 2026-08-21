import { AlertTriangle } from 'lucide-react'
import { firebaseConfigured } from '@/lib/firebase'
import { supabaseConfigured } from '@/lib/supabase'

export function ConfigurationNotice() {
  const missingFirebase = !firebaseConfigured
  const missingSupabase = !supabaseConfigured
  if (!missingFirebase && !missingSupabase) return null

  const items = [
    ...(missingFirebase ? ['Firebase auth'] : []),
    ...(missingSupabase ? ['Supabase live data'] : []),
  ]

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
      <div className="mx-auto flex max-w-7xl items-start gap-3 text-sm leading-6">
        <AlertTriangle size={18} className="mt-1 shrink-0 text-amber-700" />
        <p><strong>সাইটের configuration অসম্পূর্ণ।</strong> {items.join(' এবং ')} এখন সাময়িকভাবে বন্ধ। Vercel-এর environment variables সেট করলে live feature চালু হবে।</p>
      </div>
    </div>
  )
}
