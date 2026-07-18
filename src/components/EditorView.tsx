import { useCallback, useEffect, useRef, useState } from 'react'
import { BubbleMenu, EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import type { Mark } from '@tiptap/pm/model'
import { useStore } from '../state/store'
import type { PageContent } from '../vault/model'
import { deresolveAssetUrls, insertAsset, resolveAssetUrls } from '../lib/assets'
import { getLinkCard } from '../lib/linkMeta'
import { sharePageAsMarkdown } from '../lib/zip'
import { BackIcon, PinIcon, ShareIcon, TrashIcon } from './icons'
import LinkCardView from './LinkCardView'
import Toolbar from './Toolbar'

const URL_RE = /^https?:\/\/\S+$/i

function getMarkdown(editor: Editor): string {
  return (editor.storage as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
}

/** After link metadata arrives, replace raw-URL link text with the page title. */
function applyLinkTitle(editor: Editor, url: string, title: string) {
  const { state } = editor.view
  const targets: { from: number; to: number; marks: readonly Mark[] }[] = []
  state.doc.descendants((node, pos) => {
    if (!node.isText || node.text !== url) return
    const linked = node.marks.some((m) => m.type.name === 'link' && m.attrs.href === url)
    if (linked) targets.push({ from: pos, to: pos + node.nodeSize, marks: node.marks })
  })
  if (!targets.length) return
  let tr = state.tr
  for (const t of targets.reverse()) {
    tr = tr.replaceWith(t.from, t.to, state.schema.text(title, t.marks as Mark[]))
  }
  editor.view.dispatch(tr)
}

export default function EditorView({ page }: { page: PageContent }) {
  const { projects, closeEditor, saveCurrentPage, trashPage, togglePin } = useStore()
  const [title, setTitle] = useState(page.title)
  const [loaded, setLoaded] = useState(false)
  const titleRef = useRef(page.title)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const project = projects.find((p) => p.slug === page.projectSlug)
  const meta = project?.pages.find((p) => p.slug === page.slug)

  const persist = useCallback(() => {
    const editor = editorRef.current
    if (!editor || editor.isDestroyed) return
    const md = deresolveAssetUrls(getMarkdown(editor))
    void saveCurrentPage(titleRef.current.trim() || 'Untitled', md)
  }, [saveCurrentPage])

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(persist, 800)
  }, [persist])

  const insertImages = useCallback(async (files: File[]) => {
    const editor = editorRef.current
    if (!editor) return
    for (const file of files) {
      const blobUrl = await insertAsset(page.projectSlug, file)
      editor.chain().focus().setImage({ src: blobUrl, alt: file.name }).run()
    }
  }, [page.projectSlug])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({ html: false, transformPastedText: true, linkify: true }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Capture your idea…' }),
    ],
    editorProps: {
      attributes: { class: 'tiptap' },
      handlePaste: (view, event) => {
        const images = Array.from(event.clipboardData?.files ?? []).filter((f) =>
          f.type.startsWith('image/'),
        )
        if (images.length) {
          void insertImages(images)
          return true
        }
        const text = event.clipboardData?.getData('text/plain')?.trim()
        if (text && URL_RE.test(text) && view.state.selection.empty) {
          editorRef.current
            ?.chain()
            .focus()
            .insertContent([
              { type: 'text', text, marks: [{ type: 'link', attrs: { href: text } }] },
              { type: 'text', text: ' ' },
            ])
            .run()
          void getLinkCard(text).then((card) => {
            if (card?.title && editorRef.current && !editorRef.current.isDestroyed) {
              applyLinkTitle(editorRef.current, text, card.title)
            }
          })
          return true
        }
        return false
      },
    },
    onUpdate: () => scheduleSave(),
  })
  editorRef.current = editor

  // Load markdown (with asset paths swapped for blob URLs) once the editor exists.
  useEffect(() => {
    if (!editor) return
    let cancelled = false
    void resolveAssetUrls(page.body, page.projectSlug).then((resolved) => {
      if (cancelled || editor.isDestroyed) return
      editor.commands.setContent(resolved, false)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Flush pending saves on unmount.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        persist()
      }
    }
  }, [persist])

  const onBack = () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
      persist()
    }
    void closeEditor()
  }

  const onDelete = () => {
    if (!window.confirm(`Move "${titleRef.current}" to Trash?`)) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    void trashPage(page.projectSlug, project?.name ?? page.projectSlug, page.slug)
  }

  const onShare = () => {
    const editorNow = editorRef.current
    if (!editorNow) return
    void sharePageAsMarkdown(titleRef.current, deresolveAssetUrls(getMarkdown(editorNow)))
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <header className="flex items-center gap-1 px-2 pt-3">
        <button onClick={onBack} aria-label="Back" className="rounded-xl p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800">
          <BackIcon />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-400">{project?.name ?? ''}</span>
        <button
          onClick={() => void togglePin(page.projectSlug, page.slug, !(meta?.pinned ?? false))}
          aria-label={meta?.pinned ? 'Unpin' : 'Pin'}
          className={`rounded-xl p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${meta?.pinned ? 'text-indigo-500' : 'text-slate-400'}`}
        >
          <PinIcon />
        </button>
        <button onClick={onShare} aria-label="Share as Markdown" className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ShareIcon />
        </button>
        <button onClick={onDelete} aria-label="Delete" className="rounded-xl p-2.5 text-slate-400 hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800">
          <TrashIcon />
        </button>
      </header>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          titleRef.current = e.target.value
          scheduleSave()
        }}
        placeholder="Untitled"
        className="w-full bg-transparent px-4 pb-1 pt-2 text-2xl font-bold outline-none placeholder:text-slate-300 dark:placeholder:text-slate-700"
      />

      <div className="flex-1 overflow-y-auto px-4 pb-24" onClick={() => editor?.commands.focus()}>
        {loaded ? null : <p className="py-2 text-sm text-slate-400">Loading…</p>}
        <EditorContent editor={editor} className={loaded ? '' : 'hidden'} />
      </div>

      {editor && (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: e }) => e.isActive('link')}
          tippyOptions={{ placement: 'bottom', maxWidth: 360 }}
        >
          <LinkCardView editor={editor} />
        </BubbleMenu>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) void insertImages(files)
        }}
      />

      {editor && <Toolbar editor={editor} onPickImage={() => fileInputRef.current?.click()} />}
    </div>
  )
}
