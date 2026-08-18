type RpcErrorLike = { code?: string | null; message?: string | null } | null | undefined

export function formatAdminRpcError(error: RpcErrorLike, subject: string, migrationHint?: string) {
  const message = error?.message?.trim() ?? ''
  const normalized = message.toLowerCase()
  const code = error?.code ?? ''

  if (normalized.includes('not authorized') || normalized.includes('permission denied') || normalized.includes('permission')) {
    return `এই admin account-এর ${subject} দেখার permission নেই। Admin Team থেকে role ও permission যাচাই করুন।`
  }

  if (code === 'PGRST202' || normalized.includes('function') && (normalized.includes('does not exist') || normalized.includes('not found'))) {
    return `${subject} চালানোর Supabase RPC পাওয়া যায়নি। ${migrationHint ?? 'প্রয়োজনীয় migration'} এবং RPC নাম যাচাই করুন।`
  }

  if (normalized.includes('relation') && normalized.includes('does not exist')) {
    return `${subject}-এর database table পাওয়া যায়নি। ${migrationHint ?? 'প্রয়োজনীয় migration'} প্রয়োগ হয়েছে কি না যাচাই করুন।`
  }

  return message ? `${subject} লোড করা যায়নি। Supabase বলেছে: ${message}` : `${subject} লোড করা যায়নি। Supabase error-এর বিস্তারিত পাওয়া যায়নি।`
}
