import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { supabase } from '@/lib/supabase'

type SettingRow = { setting_key: string; setting_value: { value?: string } | string }

export function SiteMeta() {
  const [settings, setSettings] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.rpc('get_public_settings', { p_prefix: 'public_seo_' }).then(({ data }) => {
      const next: Record<string, string> = {}
      ;(data ?? []).forEach((row: SettingRow) => {
        next[row.setting_key] = typeof row.setting_value === 'string' ? row.setting_value : row.setting_value?.value ?? ''
      })
      setSettings(next)
    })
  }, [])

  return <Helmet>
    {settings.public_seo_title && <title>{settings.public_seo_title}</title>}
    {settings.public_seo_description && <meta name="description" content={settings.public_seo_description} />}
    {settings.public_seo_og_image && <meta property="og:image" content={settings.public_seo_og_image} />}
    {settings.public_seo_google_verification && <meta name="google-site-verification" content={settings.public_seo_google_verification} />}
  </Helmet>
}
