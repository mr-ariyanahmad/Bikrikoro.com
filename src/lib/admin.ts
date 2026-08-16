import { supabase } from '@/lib/supabase'
import type { DisputeStatus } from '@/types/order'

export async function resolveDispute(params: {
  adminId: string
  disputeId: string
  status: Extract<DisputeStatus, 'UNDER_REVIEW' | 'RESOLVED_REFUNDED' | 'RESOLVED_DENIED'>
  resolutionNote: string
}) {
  const { error } = await supabase.rpc('admin_resolve_dispute', {
    p_admin_id: params.adminId,
    p_dispute_id: params.disputeId,
    p_status: params.status,
    p_resolution_note: params.resolutionNote,
  })
  if (error) throw error
}

export async function reviewSellerRegistration(params: {
  adminId: string
  registrationId: string
  status: 'APPROVED' | 'REJECTED'
  adminNote: string
}) {
  const { error } = await supabase.rpc('admin_review_seller_registration', {
    p_admin_id: params.adminId,
    p_registration_id: params.registrationId,
    p_status: params.status,
    p_admin_note: params.adminNote,
  })
  if (error) throw error
}
