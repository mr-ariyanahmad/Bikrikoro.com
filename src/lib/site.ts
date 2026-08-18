const configuredSiteUrl = import.meta.env.VITE_SITE_URL || window.location.origin

export const SITE_URL = configuredSiteUrl.replace(/\/$/, '')
