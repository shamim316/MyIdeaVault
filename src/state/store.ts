import { create } from 'zustand'
import { indexPage, removePage, resetIndex, type SearchDoc } from '../lib/search'
import { releaseAssetUrls } from '../lib/assets'
import { vault } from '../vault/VaultService'
import type { PageContent, Project, TrashItem } from '../vault/model'

export type Theme = 'system' | 'light' | 'dark'

interface AppState {
  status: 'loading' | 'ready' | 'unsupported'
  projects: Project[]
  view: 'home' | 'page'
  current: PageContent | null
  searchOpen: boolean
  settingsOpen: boolean
  trash: TrashItem[]
  theme: Theme
  installPrompt: (() => Promise<void>) | null

  init(): Promise<void>
  refresh(): Promise<void>
  openPage(projectSlug: string, pageSlug: string): Promise<void>
  closeEditor(): Promise<void>
  createProject(name: string): Promise<void>
  renameProject(slug: string, name: string): Promise<void>
  deleteProject(slug: string, name: string): Promise<void>
  createPage(projectSlug: string, title?: string): Promise<void>
  quickCapture(): Promise<void>
  saveCurrentPage(title: string, body: string): Promise<void>
  trashPage(projectSlug: string, projectName: string, pageSlug: string): Promise<void>
  togglePin(projectSlug: string, pageSlug: string, pinned: boolean): Promise<void>
  refreshTrash(): Promise<void>
  restoreFromTrash(fileName: string): Promise<void>
  deleteFromTrash(fileName: string): Promise<void>
  setSearchOpen(open: boolean): void
  setSettingsOpen(open: boolean): void
  setTheme(theme: Theme): void
  setInstallPrompt(fn: (() => Promise<void>) | null): void
}

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

async function buildSearchIndex(projects: Project[]): Promise<void> {
  const docs: SearchDoc[] = []
  for (const project of projects) {
    for (const page of project.pages) {
      try {
        const content = await vault.readPage(project.slug, page.slug)
        docs.push({
          id: `${project.slug}/${page.slug}`,
          projectSlug: project.slug,
          pageSlug: page.slug,
          title: content.title,
          body: content.body,
        })
      } catch {
        /* skip unreadable page */
      }
    }
  }
  resetIndex(docs)
}

export const useStore = create<AppState>((set, get) => ({
  status: 'loading',
  projects: [],
  view: 'home',
  current: null,
  searchOpen: false,
  settingsOpen: false,
  trash: [],
  theme: (localStorage.getItem('theme') as Theme) || 'system',
  installPrompt: null,

  async init() {
    applyTheme(get().theme)
    if (!navigator.storage?.getDirectory) {
      set({ status: 'unsupported' })
      return
    }
    await vault.init()
    navigator.storage.persist?.().catch(() => {})
    const projects = await vault.listProjects()
    if (projects.length === 0) {
      await vault.ensureInbox()
    }
    const fresh = projects.length === 0 ? await vault.listProjects() : projects
    set({ status: 'ready', projects: fresh })
    void buildSearchIndex(fresh)
  },

  async refresh() {
    set({ projects: await vault.listProjects() })
  },

  async openPage(projectSlug, pageSlug) {
    const current = await vault.readPage(projectSlug, pageSlug)
    set({ current, view: 'page', searchOpen: false })
  },

  async closeEditor() {
    releaseAssetUrls()
    await get().refresh()
    set({ current: null, view: 'home' })
  },

  async createProject(name) {
    await vault.createProject(name)
    await get().refresh()
  },

  async renameProject(slug, name) {
    await vault.renameProject(slug, name)
    await get().refresh()
  },

  async deleteProject(slug, name) {
    await vault.deleteProject(slug, name)
    const projects = get().projects.find((p) => p.slug === slug)
    for (const page of projects?.pages ?? []) removePage(`${slug}/${page.slug}`)
    await get().refresh()
  },

  async createPage(projectSlug, title = 'Untitled') {
    const pageSlug = await vault.createPage(projectSlug, title)
    await get().refresh()
    await get().openPage(projectSlug, pageSlug)
  },

  async quickCapture() {
    const inbox = await vault.ensureInbox()
    const now = new Date()
    const title = `Idea — ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
    const pageSlug = await vault.createPage(inbox, title)
    await get().refresh()
    await get().openPage(inbox, pageSlug)
  },

  async saveCurrentPage(title, body) {
    const current = get().current
    if (!current) return
    const updated = { ...current, title, body }
    await vault.savePage(updated)
    set({ current: updated })
    indexPage({
      id: `${current.projectSlug}/${current.slug}`,
      projectSlug: current.projectSlug,
      pageSlug: current.slug,
      title,
      body,
    })
  },

  async trashPage(projectSlug, projectName, pageSlug) {
    await vault.trashPage(projectSlug, projectName, pageSlug)
    removePage(`${projectSlug}/${pageSlug}`)
    await get().refresh()
    const current = get().current
    if (current && current.projectSlug === projectSlug && current.slug === pageSlug) {
      releaseAssetUrls()
      set({ current: null, view: 'home' })
    }
  },

  async togglePin(projectSlug, pageSlug, pinned) {
    await vault.setPinned(projectSlug, pageSlug, pinned)
    await get().refresh()
  },

  async refreshTrash() {
    set({ trash: await vault.listTrash() })
  },

  async restoreFromTrash(fileName) {
    await vault.restoreFromTrash(fileName)
    await get().refresh()
    await get().refreshTrash()
  },

  async deleteFromTrash(fileName) {
    await vault.deleteFromTrash(fileName)
    await get().refreshTrash()
  },

  setSearchOpen(open) {
    set({ searchOpen: open })
  },

  setSettingsOpen(open) {
    set({ settingsOpen: open })
    if (open) void get().refreshTrash()
  },

  setTheme(theme) {
    localStorage.setItem('theme', theme)
    applyTheme(theme)
    set({ theme })
  },

  setInstallPrompt(fn) {
    set({ installPrompt: fn })
  },
}))
