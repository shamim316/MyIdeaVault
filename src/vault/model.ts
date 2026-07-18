export interface PageMeta {
  slug: string
  title: string
  created: number
  updated: number
  pinned: boolean
}

export interface Project {
  slug: string
  name: string
  order: number
  pages: PageMeta[]
}

export interface PageContent {
  projectSlug: string
  slug: string
  title: string
  created: number
  body: string
}

export interface TrashItem {
  fileName: string
  title: string
  originProject: string
  originProjectName: string
  deletedAt: number
}

export const VAULT_ROOT = 'vault'
export const PROJECTS_DIR = `${VAULT_ROOT}/projects`
export const TRASH_DIR = `${VAULT_ROOT}/trash`
export const INBOX_NAME = 'Inbox'
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
