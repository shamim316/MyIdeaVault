// Minimal YAML-ish front-matter: flat string/number/boolean values only.
export type FrontMatter = Record<string, string | number | boolean>

export function parseFrontMatter(md: string): { meta: FrontMatter; body: string } {
  const meta: FrontMatter = {}
  if (!md.startsWith('---\n')) return { meta, body: md }
  const end = md.indexOf('\n---\n', 4)
  if (end === -1) return { meta, body: md }
  const header = md.slice(4, end)
  const body = md.slice(end + 5).replace(/^\n/, '')
  for (const line of header.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    let raw = line.slice(idx + 1).trim()
    if (!key) continue
    if (raw.startsWith('"')) {
      try {
        meta[key] = JSON.parse(raw)
        continue
      } catch {
        /* fall through to raw string */
      }
    }
    if (raw === 'true') meta[key] = true
    else if (raw === 'false') meta[key] = false
    else if (raw !== '' && !Number.isNaN(Number(raw))) meta[key] = Number(raw)
    else meta[key] = raw
  }
  return { meta, body }
}

export function serializeFrontMatter(meta: FrontMatter, body: string): string {
  const lines = Object.entries(meta).map(([k, v]) => {
    if (typeof v === 'string') return `${k}: ${JSON.stringify(v)}`
    return `${k}: ${v}`
  })
  return `---\n${lines.join('\n')}\n---\n\n${body.replace(/^\n+/, '')}`
}
