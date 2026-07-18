import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { domainOf, faviconUrl, getLinkCard } from '../lib/linkMeta'
import type { LinkCard } from '../lib/db'

export default function LinkCardView({ editor }: { editor: Editor }) {
  const href = editor.getAttributes('link').href as string | undefined
  const [card, setCard] = useState<LinkCard | null>(null)

  useEffect(() => {
    setCard(null)
    if (!href) return
    let cancelled = false
    getLinkCard(href)
      .then((c) => {
        if (!cancelled) setCard(c)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [href])

  if (!href) return null

  return (
    <div className="w-80 max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-2.5 p-3">
        <img
          src={faviconUrl(href)}
          alt=""
          className="mt-0.5 size-5 rounded"
          onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{card?.title || domainOf(href)}</p>
          {card?.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{card.description}</p>
          )}
          <p className="mt-0.5 truncate text-xs text-slate-400">{domainOf(href)}</p>
        </div>
      </div>
      <div className="flex border-t border-slate-100 text-sm dark:border-slate-800">
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="flex-1 px-3 py-2 text-center font-medium text-indigo-600 hover:bg-slate-50 dark:text-indigo-400 dark:hover:bg-slate-800"
        >
          Open
        </a>
        <button
          onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
          className="flex-1 px-3 py-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Remove link
        </button>
      </div>
    </div>
  )
}
