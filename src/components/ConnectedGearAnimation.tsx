import { Settings } from 'lucide-react'

export function ConnectedGearAnimation({ label = 'পেজ প্রস্তুত করার চেষ্টা চলছে' }: { label?: string }) {
  return (
    <div className="connected-gears" role="status" aria-label={label}>
      <span className="gear-link gear-link-left" aria-hidden="true" />
      <span className="gear-link gear-link-right" aria-hidden="true" />
      <Settings className="gear gear-main" aria-hidden="true" />
      <Settings className="gear gear-left" aria-hidden="true" />
      <Settings className="gear gear-right" aria-hidden="true" />
    </div>
  )
}
