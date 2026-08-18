import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export type BrandSelectOption = {
  value: string
  label: string
}

type BrandSelectProps = {
  label: string
  value: string
  options: BrandSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function BrandSelect({ label, value, options, onChange, placeholder = 'বেছে নিন', disabled = false }: BrandSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen((current) => !current)
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
    }
  }

  return <div ref={rootRef} className="relative">
    <span className="mb-1.5 block text-sm font-medium text-ink-900">{label}</span>
    <button
      type="button"
      onClick={() => setOpen((current) => !current)}
      onKeyDown={handleTriggerKeyDown}
      disabled={disabled}
      aria-label={label}
      aria-haspopup="listbox"
      aria-expanded={open}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-outline bg-surface px-3 py-2.5 text-left text-sm text-ink-700 transition hover:border-brand-500 focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-bg disabled:text-ink-300"
    >
      <span className={selected ? 'text-ink-900' : 'text-ink-400'}>{selected?.label ?? placeholder}</span>
      <ChevronDown size={17} className={`shrink-0 text-brand-600 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && !disabled && <div role="listbox" aria-label={`${label} তালিকা`} className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-brand-100 bg-surface p-1.5 shadow-xl shadow-ink-900/15">
      {options.length === 0 ? <p className="px-3 py-4 text-center text-xs text-ink-400">কোনো option পাওয়া যায়নি।</p> : options.map((option) => <button
        key={option.value}
        type="button"
        role="option"
        aria-selected={option.value === value}
        onClick={() => { onChange(option.value); setOpen(false) }}
        className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm transition ${option.value === value ? 'bg-brand-50 font-semibold text-brand-700' : 'text-ink-700 hover:bg-brand-50 hover:text-brand-700'}`}
      >
        <span>{option.label}</span>
        {option.value === value && <Check size={17} className="shrink-0 text-brand-600" />}
      </button>)}</div>}
  </div>
}
