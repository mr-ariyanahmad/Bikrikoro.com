import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('BikriKoro application error:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-5 py-12">
        <section className="w-full max-w-md rounded-3xl border border-outline bg-surface p-7 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-error/10 text-error"><AlertTriangle size={27} /></div>
          <h1 className="mt-5 text-xl font-bold text-ink-900">পেজটি ঠিকভাবে খোলা যায়নি</h1>
          <p className="mt-2 text-sm leading-6 text-ink-600">সাময়িক একটি সমস্যা হয়েছে। পেজটি আবার লোড করুন; সমস্যা থাকলে হোমে ফিরে যান।</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-bold text-white hover:bg-brand-600"><RefreshCw size={16} />আবার চেষ্টা করুন</button>
            <a href="/" className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline px-4 py-3 text-sm font-bold text-ink-700 hover:border-brand-500 hover:text-brand-700"><Home size={16} />হোমে ফিরুন</a>
          </div>
        </section>
      </main>
    )
  }
}
