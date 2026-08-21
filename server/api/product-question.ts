import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase, getVerifiedFirebaseToken, isAuthError } from './_server-auth.js'

function sendError(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message })
}

type ProductQuestionBody = {
  action?: 'answer' | 'ask' | 'report'
  questionId?: unknown
  answer?: unknown
  productId?: unknown
  question?: unknown
  reason?: unknown
  details?: unknown
}

const REPORT_REASONS = new Set(['ভুল বা বিভ্রান্তিকর তথ্য', 'নিষিদ্ধ পণ্য', 'ভুয়া বা প্রতারণামূলক তালিকা', 'অন্য কারণ'])

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed')

  try {
    const token = await getVerifiedFirebaseToken(req)
    const body = typeof req.body === 'object' && req.body ? req.body as ProductQuestionBody : {}
    const action = body.action ?? 'answer'
    const supabase = getServiceSupabase()

    if (action === 'ask' || action === 'report') {
      const productId = text(body.productId)
      if (!productId) return sendError(res, 400, 'Product ID is required')
      const { data: product, error: productError } = await supabase
        .from('public_products')
        .select('id')
        .eq('id', productId)
        .maybeSingle()
      if (productError) return sendError(res, 500, productError.message || 'Product could not be checked')
      if (!product) return sendError(res, 404, 'Public digital product not found')

      if (action === 'ask') {
        const question = text(body.question)
        if (!question) return sendError(res, 400, 'Question is required')
        if (question.length > 2000) return sendError(res, 400, 'Question is too long')
        const { data, error } = await supabase.rpc('ask_product_question', {
          p_asker_id: token.uid,
          p_product_id: productId,
          p_question: question,
        })
        if (error) return sendError(res, 400, error.message || 'Question could not be saved')
        return res.status(200).json({ questionId: data })
      }

      const reason = text(body.reason)
      const details = text(body.details)
      if (!REPORT_REASONS.has(reason)) return sendError(res, 400, 'Invalid report reason')
      if (details.length > 2000) return sendError(res, 400, 'Report details are too long')
      const { data, error } = await supabase.rpc('report_product', {
        p_reporter_id: token.uid,
        p_product_id: productId,
        p_reason: reason,
        p_details: details,
      })
      if (error) return sendError(res, 400, error.message || 'Report could not be saved')
      return res.status(200).json({ reportId: data })
    }

    if (action !== 'answer') return sendError(res, 400, 'Unsupported product-question action')
    const questionId = text(body.questionId)
    const answer = text(body.answer)
    if (!questionId || !answer) return sendError(res, 400, 'Question ID and answer are required')
    if (answer.length > 2000) return sendError(res, 400, 'Answer is too long')

    const { error } = await supabase.rpc('answer_product_question', {
      p_seller_id: token.uid,
      p_question_id: questionId,
      p_answer: answer,
    })
    if (error) return sendError(res, 400, error.message || 'Answer could not be saved')
    return res.status(200).json({ ok: true })
  } catch (error) {
    if (isAuthError(error)) return sendError(res, 401, 'Authentication required')
    console.error('Product question request failed:', error)
    return sendError(res, 500, error instanceof Error ? error.message : 'Product question request failed')
  }
}
