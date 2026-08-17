import { useState } from 'react'
import { Bot, Send } from 'lucide-react'
import { askAgentRouter } from '@/lib/agentRouter'

export function AIAssistant() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ask = async () => {
    if (!question.trim() || loading) return
    setLoading(true); setError(null)
    try {
      const result = await askAgentRouter([
        { role: 'system', content: 'আপনি BikriKoro.Com-এর Bengali help assistant। বাংলাদেশি marketplace, BDT, order, seller, payment ও safety বিষয়ে সংক্ষিপ্ত, নির্ভুল উত্তর দিন। কখনো OTP, password বা API key চাইবেন না।' },
        { role: 'user', content: question.trim() },
      ])
      setAnswer(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI help এখন চালু নেই।')
    } finally { setLoading(false) }
  }
  return <section className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-4 sm:p-5"><div className="flex items-center gap-2"><Bot size={19} className="text-brand-700" /><h2 className="font-semibold text-brand-900">AI Help Assistant</h2></div><p className="mt-1 text-xs leading-5 text-brand-800/70">আপনার প্রশ্ন লিখুন। OTP, password বা payment তথ্য কখনো লিখবেন না।</p><div className="mt-3 flex gap-2"><input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="যেমন: order না পেলে কী করব?" className="min-w-0 flex-1 rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500" /><button onClick={ask} disabled={!question.trim() || loading} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Send size={15} />{loading ? 'ভাবছে...' : 'জিজ্ঞাসা'}</button></div>{answer && <div className="mt-3 whitespace-pre-line rounded-xl bg-white p-3 text-sm leading-6 text-ink-700">{answer}</div>}{error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}</section>
}
