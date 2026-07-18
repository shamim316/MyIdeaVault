import { parseFrontMatter, serializeFrontMatter } from '../lib/frontmatter'
import { slugify, uniqueSlug } from '../lib/slug'
import { OpfsStorage } from '../storage/OpfsStorage'
import type { VaultStorage } from '../storage/VaultStorage'
import {
  INBOX_NAME,
  PROJECTS_DIR,
  TRASH_DIR,
  TRASH_RETENTION_MS,
  type PageContent,
  type PageMeta,
  type Project,
  type TrashItem,
} from './model'

interface ProjectJson {
  name: string
  order: number
}

function projectDir(slug: string) {
  return `${PROJECTS_DIR}/${slug}`
}
function pagePath(projectSlug: string, pageSlug: string) {
  return `${projectDir(projectSlug)}/pages/${pageSlug}.md`
}

export class VaultService {
  constructor(readonly storage: VaultStorage = new OpfsStorage()) {}

  async init(): Promise<void> {
    await this.storage.ensureDir(PROJECTS_DIR)
    await this.storage.ensureDir(TRASH_DIR)
    await this.purgeOldTrash()
  }

  // ---------- tree ----------

  async listProjects(): Promise<Project[]> {
    const entries = await this.storage.list(PROJECTS_DIR)
    const projects: Project[] = []
    for (const entry of entries) {
      if (entry.kind !== 'directory') continue
      const slug = entry.name
      let info: ProjectJson = { name: slug, order: 0 }
      try {
        info = { ...info, ...JSON.parse(await this.storage.readText(`${projectDir(slug)}/project.json`)) }
      } catch {
        /* tolerate missing/corrupt project.json */
      }
      const pages = await this.listPages(slug)
      projects.push({ slug, name: info.name, order: info.order, pages })
    }
    projects.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    return projects
  }

  private async listPages(projectSlug: string): Promise<PageMeta[]> {
    const entries = await this.storage.list(`${projectDir(projectSlug)}/pages`)
    const pages: PageMeta[] = []
    for (const entry of entries) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.md')) continue
      const slug = entry.name.slice(0, -3)
      try {
        const { meta } = parseFrontMatter(await this.storage.readText(pagePath(projectSlug, slug)))
        pages.push({
          slug,
          title: typeof meta.title === 'string' && meta.title ? meta.title : slug,
          created: typeof meta.created === 'number' ? meta.created : 0,
          updated: typeof meta.updated === 'number' ? meta.updated : 0,
          pinned: meta.pinned === true,
        })
      } catch {
        pages.push({ slug, title: slug, created: 0, updated: 0, pinned: false })
      }
    }
    pages.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated - a.updated)
    return pages
  }

  // ---------- projects ----------

  async createProject(name: string): Promise<string> {
    const existing = await this.listProjects()
    const slug = uniqueSlug(slugify(name), new Set(existing.map((p) => p.slug)))
    const order = existing.length ? Math.max(...existing.map((p) => p.order)) + 1 : 0
    await this.storage.ensureDir(`${projectDir(slug)}/pages`)
    await this.storage.ensureDir(`${projectDir(slug)}/assets`)
    await this.storage.writeText(
      `${projectDir(slug)}/project.json`,
      JSON.stringify({ name, order } satisfies ProjectJson, null, 2),
    )
    return slug
  }

  async renameProject(slug: string, name: string): Promise<void> {
    const path = `${projectDir(slug)}/project.json`
    let info: ProjectJson = { name, order: 0 }
    try {
      info = { ...JSON.parse(await this.storage.readText(path)), name }
    } catch {
      /* keep defaults */
    }
    await this.storage.writeText(path, JSON.stringify(info, null, 2))
  }

  async deleteProject(slug: string, projectName: string): Promise<void> {
    for (const page of await this.listPages(slug)) {
      await this.trashPage(slug, projectName, page.slug)
    }
    await this.storage.deleteDir(projectDir(slug))
  }

  async ensureInbox(): Promise<string> {
    const projects = await this.listProjects()
    const inbox = projects.find((p) => p.name === INBOX_NAME)
    if (inbox) return inbox.slug
    return this.createProject(INBOX_NAME)
  }

  // ---------- pages ----------

  async createPage(projectSlug: string, title: string): Promise<string> {
    const pages = await this.listPages(projectSlug)
    const slug = uniqueSlug(slugify(title), new Set(pages.map((p) => p.slug)))
    const now = Date.now()
    await this.storage.writeText(
      pagePath(projectSlug, slug),
      serializeFrontMatter({ title, created: now, updated: now, pinned: false }, ''),
    )
    return slug
  }

  async readPage(projectSlug: string, slug: string): Promise<PageContent> {
    const { meta, body } = parseFrontMatter(await this.storage.readText(pagePath(projectSlug, slug)))
    return {
      projectSlug,
      slug,
      title: typeof meta.title === 'string' && meta.title ? meta.title : slug,
      created: typeof meta.created === 'number' ? meta.created : Date.now(),
      body,
    }
  }

  async savePage(page: PageContent, opts?: { pinned?: boolean }): Promise<void> {
    const current = await this.readPageMetaSafe(page.projectSlug, page.slug)
    await this.storage.writeText(
      pagePath(page.projectSlug, page.slug),
      serializeFrontMatter(
        {
          title: page.title,
          created: page.created,
          updated: Date.now(),
          pinned: opts?.pinned ?? current?.pinned ?? false,
        },
        page.body,
      ),
    )
  }

  private async readPageMetaSafe(projectSlug: string, slug: string): Promise<PageMeta | null> {
    try {
      const { meta } = parseFrontMatter(await this.storage.readText(pagePath(projectSlug, slug)))
      return {
        slug,
        title: String(meta.title ?? slug),
        created: Number(meta.created ?? 0),
        updated: Number(meta.updated ?? 0),
        pinned: meta.pinned === true,
      }
    } catch {
      return null
    }
  }

  async setPinned(projectSlug: string, slug: string, pinned: boolean): Promise<void> {
    const page = await this.readPage(projectSlug, slug)
    await this.savePage(page, { pinned })
  }

  async trashPage(projectSlug: string, projectName: string, slug: string): Promise<void> {
    const raw = await this.storage.readText(pagePath(projectSlug, slug))
    const { meta, body } = parseFrontMatter(raw)
    const trashed = serializeFrontMatter(
      { ...meta, origin: projectSlug, originName: projectName, deletedAt: Date.now() },
      body,
    )
    await this.storage.writeText(`${TRASH_DIR}/${Date.now()}__${projectSlug}__${slug}.md`, trashed)
    await this.storage.deleteFile(pagePath(projectSlug, slug))
  }

  // ---------- assets ----------

  async saveAsset(projectSlug: string, file: Blob, ext: string): Promise<string> {
    const buf = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-256', buf)
    const hash = [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')
    const name = `${hash}.${ext}`
    await this.storage.writeFile(`${projectDir(projectSlug)}/assets/${name}`, new Uint8Array(buf))
    return name
  }

  async readAsset(projectSlug: string, name: string): Promise<Uint8Array> {
    return this.storage.readFile(`${projectDir(projectSlug)}/assets/${name}`)
  }

  // ---------- trash ----------

  async listTrash(): Promise<TrashItem[]> {
    const entries = await this.storage.list(TRASH_DIR)
    const items: TrashItem[] = []
    for (const entry of entries) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.md')) continue
      try {
        const { meta } = parseFrontMatter(await this.storage.readText(`${TRASH_DIR}/${entry.name}`))
        items.push({
          fileName: entry.name,
          title: String(meta.title ?? entry.name),
          originProject: String(meta.origin ?? ''),
          originProjectName: String(meta.originName ?? meta.origin ?? ''),
          deletedAt: Number(meta.deletedAt ?? 0),
        })
      } catch {
        /* skip unreadable */
      }
    }
    items.sort((a, b) => b.deletedAt - a.deletedAt)
    return items
  }

  async restoreFromTrash(fileName: string): Promise<{ projectSlug: string; pageSlug: string }> {
    const raw = await this.storage.readText(`${TRASH_DIR}/${fileName}`)
    const { meta, body } = parseFrontMatter(raw)
    const originSlug = String(meta.origin ?? '')
    const originName = String(meta.originName ?? originSlug ?? 'Restored')

    const projects = await this.listProjects()
    let target = projects.find((p) => p.slug === originSlug)?.slug
    if (!target) target = await this.createProject(originName || 'Restored')

    const pages = await this.listPages(target)
    const baseSlug = fileName.split('__')[2]?.replace(/\.md$/, '') || slugify(String(meta.title ?? 'restored'))
    const pageSlug = uniqueSlug(baseSlug, new Set(pages.map((p) => p.slug)))

    const { origin: _o, originName: _n, deletedAt: _d, ...rest } = meta
    await this.storage.writeText(
      pagePath(target, pageSlug),
      serializeFrontMatter({ ...rest, updated: Date.now() }, body),
    )
    await this.storage.deleteFile(`${TRASH_DIR}/${fileName}`)
    return { projectSlug: target, pageSlug }
  }

  async deleteFromTrash(fileName: string): Promise<void> {
    await this.storage.deleteFile(`${TRASH_DIR}/${fileName}`)
  }

  private async purgeOldTrash(): Promise<void> {
    const cutoff = Date.now() - TRASH_RETENTION_MS
    for (const item of await this.listTrash()) {
      if (item.deletedAt > 0 && item.deletedAt < cutoff) {
        await this.deleteFromTrash(item.fileName).catch(() => {})
      }
    }
  }
}

export const vault = new VaultService()
