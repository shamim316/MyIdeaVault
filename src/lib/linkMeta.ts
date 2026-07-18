import { db, type LinkCard } from './db'

const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000
// Chrome for Android blocks most cross-origin page fetches (no CORS headers on
// arbitrary sites), so we fall back to a public CORS-relay. Best-effort only:
// links stay plain Markdown links if metadata can't be fetched.
const CORS_RELAY = (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`

export function faviconUrl(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`
  } catch {
    return ''
  }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

async function fetchHtml(url: string, signal: AbortSignal): Promise<string | null> {
  for (const target of [url, CORS_RELAY(url)]) {
    try {
      const res = await fetch(target, { signal, redirect: 'follow' })
      if (!res.ok) continue
      const type = res.headers.get('content-type') ?? ''
      if (type && !type.includes('html') && !type.includes('text')) continue
      return await res.text()
    } catch {
      /* try next */
    }
  }
  return null
}

function extractMeta(html: string): { title: string; description: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const og = (prop: string) =>
    doc.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)?.getAttribute('content')?.trim() ?? ''
  const title = og('og:title') || doc.querySelector('title')?.textContent?.trim() || ''
  const description = og('og:description') || og('description') || ''
  return { title, description }
}

export async function getLinkCard(url: string): Promise<LinkCard | null> {
  if (!/^https?:\/\//i.test(url)) return null
  const cached = await db.linkCards.get(url)
  if (cached && Date.now() - cached.fetchedAt < REFRESH_AFTER_MS) {
    return cached.failed && !cached.title ? cached : cached
  }
  if (!navigator.onLine) return cached ?? null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const html = await fetchHtml(url, controller.signal)
    const meta = html ? extractMeta(html) : { title: '', description: '' }
    const card: LinkCard = {
      url,
      title: meta.title,
      description: meta.description.slice(0, 300),
      fetchedAt: Date.now(),
      failed: !meta.title,
    }
    await db.linkCards.put(card)
    return card
  } finally {
    clearTimeout(timer)
  }
}
