const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'])

export function getYouTubeVideoId(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    if (!['https:', 'http:'].includes(url.protocol) || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null

    let id = ''
    if (url.hostname.toLowerCase().includes('youtu.be')) {
      id = url.pathname.split('/').filter(Boolean)[0] ?? ''
    } else if (url.pathname.startsWith('/embed/')) {
      id = url.pathname.split('/')[2] ?? ''
    } else if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/live/')) {
      id = url.pathname.split('/')[2] ?? ''
    } else {
      id = url.searchParams.get('v') ?? ''
    }

    return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export function getYouTubeEmbedUrl(value: string | null | undefined): string | null {
  const id = getYouTubeVideoId(value)
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : null
}

export function isYouTubeUrl(value: string | null | undefined): boolean {
  return Boolean(getYouTubeVideoId(value))
}
