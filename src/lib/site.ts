const browserOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://www.bikrikoro.com'
const configuredSiteUrl = import.meta.env.VITE_SITE_URL || browserOrigin
const productionHost = typeof window !== 'undefined' && ['bikrikoro.com', 'www.bikrikoro.com'].includes(window.location.hostname)

export const SITE_URL = productionHost ? 'https://www.bikrikoro.com' : configuredSiteUrl.replace(/\/$/, '')
