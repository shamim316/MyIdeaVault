import { useEffect, useRef, useState } from 'react'
import { searchPages, type SearchHit } from '../lib/search'
import { useStore } from '../state/store'
import { BackIcon, SearchIcon } from './icons'

export default function SearchOverlay() {
  const { projects, setSearchOpen, openPage } = useStore()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setHits(searchPages(query))
  }, [query])

  const projectName = (slug: string) => projects.find((p) => p.slug === slug)?.name ?? slug

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex h-full max-w-2xl flex-col">
        <div className="flex items-center gap-1 px-2 pt-3">
          <button
            onClick={() => setSearchOpen(false)}
            aria-label="Close search"
            className="rounded-xl p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <BackIcon />
          </button>
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-slate-800">
            <SearchIcon className="size-4 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all ideas…"
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto px-2 py-2">
          {hits.map((hit) => (
            <li key={`${hit.projectSlug}/${hit.pageSlug}`}>
              <button
                onClick={() => void openPage(hit.projectSlug, hit.pageSlug)}
                className="w-full rounded-xl px-3 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                <p className="font-semibold">{hit.title}</p>
                <p className="text-xs text-indigo-500">{projectName(hit.projectSlug)}</p>
                {hit.snippet && <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{hit.snippet}</p>}
              </button>
            </li>
          ))}
          {query.trim() !== '' && hits.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-slate-400">No matches</li>
          )}
        </ul>
      </div>
    </div>
  )
}
