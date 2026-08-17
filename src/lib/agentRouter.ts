type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type AgentRouterResponse = { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }

export async function askAgentRouter(messages: ChatMessage[], model?: string) {
  const response = await fetch('/api/agent-router', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model }),
  })
  const data = (await response.json()) as AgentRouterResponse
  if (!response.ok) throw new Error(data.error?.message || 'AI সহায়তা এখন পাওয়া যাচ্ছে না।')
  return data.choices?.[0]?.message?.content?.trim() || 'এই প্রশ্নের উত্তর এখন তৈরি করা যাচ্ছে না।'
}
