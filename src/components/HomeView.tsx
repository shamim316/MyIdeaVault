import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import type { Project } from '../vault/model'
import { BulbIcon, ChevronIcon, DotsIcon, GearIcon, PinIcon, PlusIcon, SearchIcon } from './icons'

function timeAgo(ts: number): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  return new Date(ts).toLocaleDateString()
}

function ProjectMenu({ project, onClose }: { project: Project; onClose: () => void }) {
  const { createPage, renameProject, deleteProject } = useStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [onClose])

  const item = 'w-full px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800'
  return (
    <div
      ref={ref}
      className="absolute right-2 top-9 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
    >
      <button
        className={item}
        onClick={() => {
          onClose()
          const title = window.prompt('Page title', 'Untitled')
          if (title) void createPage(project.slug, title)
        }}
      >
        New page
      </button>
      <button
        className={item}
        onClick={() => {
          onClose()
          const name = window.prompt('Rename project', project.name)
          if (name?.trim()) void renameProject(project.slug, name.trim())
        }}
      >
        Rename
      </button>
      <button
        className={`${item} text-red-600 dark:text-red-400`}
        onClick={() => {
          onClose()
          if (window.confirm(`Delete "${project.name}"? Its pages move to Trash for 30 days.`)) {
            void deleteProject(project.slug, project.name)
          }
        }}
      >
        Delete project
      </button>
    </div>
  )
}

function ProjectSection({ project }: { project: Project }) {
  const { openPage } = useStore()
  const storageKey = `expanded:${project.slug}`
  const [open, setOpen] = useState(() => localStorage.getItem(storageKey) !== '0')
  const [menuOpen, setMenuOpen] = useState(false)

  const toggle = () => {
    setOpen((v) => {
      localStorage.setItem(storageKey, v ? '0' : '1')
      return !v
    })
  }

  return (
    <section className="relative">
      <div className="flex items-center gap-1 px-2">
        <button
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60"
        >
          <ChevronIcon open={open} className="size-4 shrink-0 text-slate-400" />
          <span className="truncate font-semibold">{project.name}</span>
          <span className="text-xs text-slate-400">{project.pages.length}</span>
        </button>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`Options for ${project.name}`}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
        >
          <DotsIcon className="size-4" />
        </button>
      </div>
      {menuOpen && <ProjectMenu project={project} onClose={() => setMenuOpen(false)} />}
      {open && (
        <ul className="pb-1">
          {project.pages.map((page) => (
            <li key={page.slug}>
              <button
                onClick={() => void openPage(project.slug, page.slug)}
                className="flex w-full items-center gap-2 rounded-lg py-2.5 pl-10 pr-4 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60"
              >
                {page.pinned && <PinIcon className="size-3.5 shrink-0 text-indigo-500" />}
                <span className="min-w-0 flex-1 truncate text-[15px]">{page.title}</span>
                <span className="shrink-0 text-xs text-slate-400">{timeAgo(page.updated)}</span>
              </button>
            </li>
          ))}
          {project.pages.length === 0 && (
            <li className="py-2 pl-10 pr-4 text-sm text-slate-400">No pages yet</li>
          )}
        </ul>
      )}
    </section>
  )
}

export default function HomeView() {
  const { projects, createProject, quickCapture, setSearchOpen, setSettingsOpen } = useStore()

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <header className="flex items-center gap-2 px-4 pb-2 pt-4">
        <BulbIcon className="size-6 text-indigo-500" />
        <h1 className="flex-1 text-lg font-bold">My Idea Vault</h1>
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="rounded-xl p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <SearchIcon />
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="rounded-xl p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <GearIcon />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-28">
        {projects.map((project) => (
          <ProjectSection key={project.slug} project={project} />
        ))}
        <div className="px-4 pt-2">
          <button
            onClick={() => {
              const name = window.prompt('Project name')
              if (name?.trim()) void createProject(name.trim())
            }}
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
          >
            <PlusIcon className="size-4" /> New project
          </button>
        </div>
      </main>

      <button
        onClick={() => void quickCapture()}
        aria-label="Quick idea"
        className="fixed bottom-6 right-5 flex items-center gap-2 rounded-full bg-indigo-600 py-4 pl-4 pr-5 font-semibold text-white shadow-lg shadow-indigo-600/30 active:scale-95"
      >
        <PlusIcon /> Quick idea
      </button>
    </div>
  )
}
