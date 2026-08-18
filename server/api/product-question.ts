import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

function sendError(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed')

  try {
    const token = await getVerifiedFirebaseToken(req)
    const body = typeof req.body === 'object' && req.body ? req.body as { questionId?: unknown; answer?: unknown } : {}
    const questionId = typeof body.questionId === 'string' ? body.questionId.trim() : ''
    const answer = typeof body.answer === 'string' ? body.answer.trim() : ''
    if (!questionId || !answer) return sendError(res, 400, 'Question ID and answer are required')
    if (answer.length > 2000) return sendError(res, 400, 'Answer is too long')

    const supabase = getServiceSupabase()
    const { error } = await supabase.rpc('answer_product_question', {
      p_seller_id: token.uid,
      p_question_id: questionId,
      p_answer: answer,
    })
    if (error) return sendError(res, 400, error.message || 'Answer could not be saved')
    return res.status(200).json({ ok: true })
  } catch (error) {
    if (isAuthError(error)) return sendError(res, 401, 'Authentication required')
    console.error('Product question answer failed:', error)
    return sendError(res, 500, error instanceof Error ? error.message : 'Answer could not be saved')
  }
}
