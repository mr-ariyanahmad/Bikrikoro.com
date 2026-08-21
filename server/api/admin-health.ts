import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

type CheckState = 'OK' | 'ERROR' | 'MANUAL'
type HealthCheck = { key: string; label: string; state: CheckState; value: string; detail: string }

type SecurityBaseline = { baseline_key?: string; migration_version?: string; ready?: boolean; checks?: Record<string, boolean>; applied_at?: string; updated_at?: string }
type SystemStatus = { profiles?: number; products?: number; orders?: number; pending_orders?: number; schema_marker?: string | null; security_baseline?: SecurityBaseline | null; updated_at?: string }

function configured(...values: Array<string | undefined>) {
  return values.every((value) => Boolean(value?.trim()))
}

function check(key: string, label: string, state: CheckState, value: string, detail: string): HealthCheck {
  return { key, label, state, value, detail }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const token = await getVerifiedFirebaseToken(req)
    const supabase = getServiceSupabase()
    const startedAt = Date.now()
    const [{ data: systemStatus, error: systemError }, { data: baselineData, error: baselineError }, { data: buckets, error: storageError }] = await Promise.all([
      supabase.rpc('admin_get_system_status', { p_admin_id: token.uid }),
      supabase.rpc('admin_get_security_baseline', { p_admin_id: token.uid }),
      supabase.storage.listBuckets(),
    ])
    const status = (systemStatus ?? {}) as SystemStatus
    const baseline = (baselineData ?? status.security_baseline ?? null) as SecurityBaseline | null
    const firebasePushConfigured = Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
      || configured(process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID, process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL, process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY),
    )

    const checks: HealthCheck[] = [
      check('firebase_auth', 'Firebase server authentication', 'OK', 'চালু', 'এই request-এর Firebase ID token server-এ যাচাই হয়েছে।'),
      check('supabase_database', 'Supabase database', systemError ? 'ERROR' : 'OK', systemError ? 'ব্যর্থ' : `${Date.now() - startedAt}ms`, systemError ? 'Database status RPC response দেয়নি।' : `${status.profiles ?? 0} profile · ${status.products ?? 0} product · ${status.orders ?? 0} order`),
      check('supabase_storage', 'Supabase storage', storageError ? 'ERROR' : 'OK', storageError ? 'ব্যর্থ' : `${buckets?.length ?? 0} bucket`, storageError ? 'Storage bucket list করা যায়নি।' : 'Storage service থেকে bucket list response পাওয়া গেছে।'),
      check('schema_marker', 'Database schema marker', status.schema_marker === '080_security_baseline' ? 'OK' : 'MANUAL', status.schema_marker || 'চিহ্নিত নয়', status.schema_marker === '080_security_baseline' ? 'Repository-এর বর্তমান security baseline marker পাওয়া গেছে।' : '080 security-baseline migration এখনো live schema-তে নিশ্চিত নয়।'),
      check('security_baseline', 'Security hardening baseline', baselineError ? 'MANUAL' : baseline?.ready === true ? 'OK' : 'ERROR', baselineError ? 'যাচাই হয়নি' : baseline?.migration_version || 'অসম্পূর্ণ', baselineError ? '080 security-baseline migration apply হলে এই verification চালু হবে।' : baseline?.ready === true ? 'Wallet, chat, user-scoped feature এবং public projection hardening baseline সম্পূর্ণ।' : 'Tracked hardening migrations-এর এক বা একাধিক অংশ অনুপস্থিত বা অসম্পূর্ণ।'),
      check('agent_router', 'AI Help configuration', configured(process.env.AGENT_ROUTER_BASE_URL, process.env.AGENT_ROUTER_API_KEY, process.env.AGENT_ROUTER_MODEL) ? 'OK' : 'ERROR', configured(process.env.AGENT_ROUTER_BASE_URL, process.env.AGENT_ROUTER_API_KEY, process.env.AGENT_ROUTER_MODEL) ? 'configured' : 'অসম্পূর্ণ', 'শুধু configuration উপস্থিতি যাচাই করা হয়েছে; কোনো secret value দেখানো হয়নি।'),
      check('firebase_push', 'Firebase push configuration', firebasePushConfigured ? 'OK' : 'ERROR', firebasePushConfigured ? 'configured' : 'অসম্পূর্ণ', 'Push service-এর server credential উপস্থিতি যাচাই করা হয়েছে।'),
      check('email', 'Email notification configuration', configured(process.env.RESEND_API_KEY, process.env.RESEND_FROM_EMAIL) ? 'OK' : 'MANUAL', configured(process.env.RESEND_API_KEY, process.env.RESEND_FROM_EMAIL) ? 'configured' : 'চিহ্নিত নয়', 'Email provider configuration-এর উপস্থিতি যাচাই করা হয়েছে।'),
      check('notification_webhook', 'Notification webhook secret', configured(process.env.NOTIFICATION_WEBHOOK_SECRET) ? 'OK' : 'ERROR', configured(process.env.NOTIFICATION_WEBHOOK_SECRET) ? 'configured' : 'অসম্পূর্ণ', 'Webhook secret-এর value কখনো admin screen-এ দেখানো হয় না।'),
      check('payment', 'Online payment gateway', 'MANUAL', 'লাইভ টেস্ট বাকি', 'কোনো real charge না দিয়ে payment gateway healthy বলা হচ্ছে না; test payment দিয়ে যাচাই করুন।'),
    ]

    res.status(200).json({ checked_at: new Date().toISOString(), checks })
  } catch (error) {
    if (isAuthError(error)) {
      res.status(401).json({ error: 'Firebase authentication is required' })
      return
    }
    console.error('Admin health check failed:', error)
    res.status(500).json({ error: 'সিস্টেম health check সম্পন্ন করা যায়নি।' })
  }
}
