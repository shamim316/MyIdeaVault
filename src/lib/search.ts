import MiniSearch from 'minisearch'

export interface SearchDoc {
  id: string // `${projectSlug}/${pageSlug}`
  projectSlug: string
  pageSlug: string
  title: string
  body: string
}

export interface SearchHit {
  projectSlug: string
  pageSlug: string
  title: string
  snippet: string
}

const docs = new Map<string, SearchDoc>()
let index = buildIndex()

function buildIndex(): MiniSearch<SearchDoc> {
  const mini = new MiniSearch<SearchDoc>({
    fields: ['title', 'body'],
    storeFields: ['projectSlug', 'pageSlug', 'title', 'body'],
    searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.15 },
  })
  mini.addAll([...docs.values()])
  return mini
}

export function indexPage(doc: SearchDoc): void {
  docs.set(doc.id, doc)
  index = buildIndex()
}

export function removePage(id: string): void {
  docs.delete(id)
  index = buildIndex()
}

export function resetIndex(all: SearchDoc[]): void {
  docs.clear()
  for (const doc of all) docs.set(doc.id, doc)
  index = buildIndex()
}

function snippetFor(body: string, query: string): string {
  const plain = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*`_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const term = query.split(/\s+/)[0]?.toLowerCase() ?? ''
  const at = term ? plain.toLowerCase().indexOf(term) : -1
  const start = at > 40 ? at - 40 : 0
  const chunk = plain.slice(start, start + 140)
  return (start > 0 ? '…' : '') + chunk + (start + 140 < plain.length ? '…' : '')
}

export function searchPages(query: string, limit = 20): SearchHit[] {
  if (!query.trim()) return []
  return index.search(query).slice(0, limit).map((r) => ({
    projectSlug: r.projectSlug as string,
    pageSlug: r.pageSlug as string,
    title: r.title as string,
    snippet: snippetFor((r.body as string) ?? '', query),
  }))
}
