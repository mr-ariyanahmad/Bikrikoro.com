type BrandLoaderProps = {
  message?: string
  fullScreen?: boolean
  compact?: boolean
}

export function BrandLoader({ message = 'BikriKoro প্রস্তুত হচ্ছে…', fullScreen = false, compact = false }: BrandLoaderProps) {
  const logoSize = compact ? 'h-11 w-11' : fullScreen ? 'h-24 w-24 sm:h-28 sm:w-28' : 'h-16 w-16'
  return <div className={fullScreen ? 'flex min-h-[100dvh] items-center justify-center bg-bg px-5' : 'flex items-center justify-center'} role="status" aria-live="polite" aria-label={message}>
    <div className={fullScreen ? 'brand-loader-card text-center' : 'text-center'}>
      <div className="brand-loader-mascot relative mx-auto inline-flex items-center justify-center">
        <span className="brand-loader-orbit brand-loader-orbit-one" />
        <span className="brand-loader-orbit brand-loader-orbit-two" />
        <div className={`${logoSize} brand-loader-logo-frame relative z-10`} aria-hidden="true">
          <img src="/icon-512.png" alt="" className="brand-loader-logo h-full w-full rounded-2xl shadow-[0_12px_30px_rgba(1,124,80,0.22)]" />
        </div>
        <span className="brand-loader-spark brand-loader-spark-left" />
        <span className="brand-loader-spark brand-loader-spark-right" />
      </div>
      {!compact && <><p className="mt-5 text-base font-bold text-brand-700">{message}</p><p className="mt-1 text-xs font-medium text-ink-500">একটু অপেক্ষা করুন</p></>}
    </div>
  </div>
}
