# My Idea Vault — Product & Technical Plan

A friction-free, local-first idea capture app for Android, built as a
Progressive Web App (PWA). Notes are Markdown, edited in a WYSIWYG editor,
organized as **Projects → Pages**, with images and links stored locally on the
device. No accounts, no server, no sign-in.

---

## 1. Goals & Non-Goals

### Goals
- **Zero friction capture**: from opening the app to typing an idea in under 2 seconds.
- **Local-first**: all data (notes, images, link metadata) lives on the user's device. Works fully offline.
- **Markdown as the storage format**: every page is a portable `.md` file the user can export and own forever.
- **WYSIWYG editing**: users never see raw Markdown syntax unless they want to.
- **Project → Page hierarchy** visible immediately on launch.
- **No authentication** — single user, single device.

### Non-Goals (v1)
- Cloud sync / multi-device
- Collaboration / sharing between users
- Play Store distribution (PWA instead)
- Encryption at rest (can be a later feature)

---

## 2. Distribution: PWA instead of Play Store — the honest answer

**Yes, a PWA is a good fit**, with one important caveat you should decide on
up front.

### What a PWA on Android *can* do
- **Install to home screen** with its own icon, splash screen, and standalone (no browser chrome) window — feels like a native app.
- **Work fully offline** via a Service Worker.
- **Store data locally and durably**:
  - **OPFS (Origin Private File System)** — a real filesystem API where we can store actual `.md` files and image files. Fast, supported on Chrome for Android.
  - **IndexedDB** — structured metadata (page index, ordering, tags).
  - `navigator.storage.persist()` — asks the browser to mark storage as *persistent* so it is not evicted under storage pressure.
- **Receive shares from other apps** via the **Web Share Target API** — e.g. share a URL or image from any Android app straight into the vault. This is a killer feature for "remove friction."
- **No store review, instant updates** — deploy to any static host (or even serve from the device), users always run the latest version.

### The caveat: where the Markdown files live
On **Chrome for Android**, the File System Access API's directory picker
(`showDirectoryPicker`) is **not available** (it's desktop-only). That means a
PWA **cannot write files directly into a user-visible folder** like
`Documents/IdeaVault/`.

What we *can* do:
- Store the real `.md` + image files in **OPFS** — genuinely on-device, genuinely files, but inside browser-managed storage that file-manager apps can't browse.
- Give the user full ownership through **Export**:
  - "Export vault" → a `.zip` of the whole folder tree (projects/pages/assets), saved via the download/share sheet into user-visible storage.
  - Per-page "Share as .md" via the Web Share API.
  - Optional periodic auto-export reminder (data safety).

**Decision for v1**: PWA + OPFS + robust export/import.

**Upgrade path if user-visible files become a hard requirement**: wrap the
exact same codebase with **Capacitor**. That produces an APK (sideloadable —
still no Play Store needed) with native Storage Access Framework access, so the
vault can live in `Documents/`. The web code doesn't change; storage goes
behind an interface (see §5) so swapping the backend is cheap.

### Risks to design around
- **Storage eviction**: if the user clears browser data, the vault is gone. Mitigations: request persistent storage on first run, surface storage status in Settings, make export one tap, and nudge for periodic backups.
- **Browser dependence**: works best in Chrome/Edge on Android. Firefox for Android has weaker install/OPFS support. Document Chrome as the supported browser.

---

## 3. Core User Experience

### Launch screen = the vault tree
Opening the app shows the **Project → Page hierarchy** immediately:

```
My Idea Vault
├─ 📁 App Ideas            (project)
│   ├─ 📄 Fitness tracker
│   └─ 📄 Recipe scanner
├─ 📁 Business
│   └─ 📄 Coffee cart plan
└─ ＋ New project
```

- Projects are collapsible; expanded/collapsed state is remembered.
- Tapping a page opens the editor; long-press for rename / move / delete.
- A prominent **floating “＋ Quick idea” button** creates a page in an **Inbox**
  project and drops you straight into the editor — capture first, organize later.

### Editor (WYSIWYG)
- Rich-text surface that reads/writes **Markdown** under the hood.
- Toolbar (mobile-friendly, above the keyboard): bold, italic, headings,
  bullet/numbered/task lists, quote, code, link, image.
- **Autosave** — no save button, ever. Debounced write-through to storage.
- Insert images from camera or gallery; images are copied into the vault
  (never referenced from external storage) so pages are self-contained.
- Paste a URL → stored as a normal Markdown link; optionally rendered as a
  link card with locally-cached title/favicon (fetched once when online,
  cached forever).

---

## 4. Feature List

### v1 (MVP)
| Feature | Notes |
|---|---|
| Project/Page tree on launch | Collapsible, remembered state, drag-to-reorder |
| WYSIWYG Markdown editor | Tiptap-based, mobile toolbar, autosave |
| Images | Camera/gallery insert, stored locally in vault assets |
| Links | Markdown links; local link cards (cached metadata) |
| Quick capture (＋ button → Inbox) | Sub-2-second idea capture |
| Full-text search | Across all projects/pages, instant, local index |
| Export / Import | Full vault as zip of Markdown + assets; per-page share |
| Offline support | Service worker, full functionality offline |
| Install prompt | Custom "Add to home screen" onboarding |
| Persistent storage request | + storage usage display in Settings |
| Dark mode | Follows system theme, manual override |
| Trash | Deleted pages/projects recoverable for 30 days |

### v1.1 (high-value, low-cost additions)
- **Web Share Target**: share text/URLs/images from any Android app into the Inbox — the single biggest friction remover after MVP.
- **Tags** (`#idea #urgent`) with a tag browser.
- **Pinned pages** at the top of a project.
- **Page templates** (e.g. "Idea": Problem / Solution / Why now).
- **Word count & created/updated timestamps** on each page.

### Later / exploratory
- Wiki-style `[[page links]]` between pages + backlinks panel.
- Voice capture (record → attach audio, or on-device speech-to-text).
- Reminders ("resurface this idea in 2 weeks") via Notification API.
- Optional vault encryption with a passphrase.
- Optional sync (user-provided: e.g. export to a folder synced by another app, or WebDAV) — keeping the no-server promise.
- Capacitor wrapper → sideloadable APK with user-visible file storage.

---

## 5. Technical Architecture

### Stack
| Layer | Choice | Why |
|---|---|---|
| Framework | **React + TypeScript + Vite** | Mature ecosystem, best editor-library support |
| Editor | **Tiptap** (ProseMirror) + Markdown serialization | Best-in-class mobile WYSIWYG; clean MD in/out |
| Storage: files | **OPFS** (`navigator.storage.getDirectory()`) | Real `.md`/image files on device |
| Storage: index | **IndexedDB via Dexie** | Fast tree/metadata queries without parsing files |
| Search | **MiniSearch** (in-memory index, persisted to IDB) | Tiny, fast, fully local full-text search |
| PWA plumbing | **vite-plugin-pwa** (Workbox) | Service worker, manifest, offline precache |
| UI | Tailwind CSS | Fast to build a clean mobile-first UI |
| State | Zustand (or React context) | Small app, keep it light |

### Storage layout (inside OPFS)
```
/vault
  /projects
    /<project-slug>
      project.json           # name, order, created, settings
      /pages
        <page-slug>.md       # pure Markdown, front-matter for metadata
      /assets
        <hash>.<ext>         # images (content-addressed to dedupe)
  /trash                     # soft-deleted items, purged after 30 days
  vault.json                 # vault-level settings, schema version
```

- Pages carry YAML front-matter (`title`, `created`, `updated`, `tags`, `pinned`) so exported files remain self-describing.
- Images are referenced from Markdown as relative paths (`../assets/abc123.png`) so an exported zip opens correctly in Obsidian/VS Code/any Markdown tool.
- IndexedDB holds a derived index (tree structure, ordering, search index, link-card cache). **OPFS is the source of truth**; the index can always be rebuilt by re-scanning files.

### Storage abstraction (the Capacitor escape hatch)
All file operations go through a single interface:

```ts
interface VaultStorage {
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, data: Uint8Array): Promise<void>
  deleteFile(path: string): Promise<void>
  list(dir: string): Promise<Entry[]>
  move(from: string, to: string): Promise<void>
}
```

v1 ships `OpfsStorage`. If we later wrap with Capacitor, we add
`CapacitorFsStorage` and nothing else changes.

### Editor ↔ Markdown flow
1. Open page → read `.md` from OPFS → parse Markdown → Tiptap document.
2. User edits WYSIWYG → on change (debounced ~800 ms) serialize back to Markdown → write to OPFS → update index + search.
3. Image insert → hash file → write to `/assets` → insert relative-path image node.

### Offline & install
- Workbox precaches the app shell; the app never needs the network to function.
- Link-card metadata fetches are best-effort, online-only, cached in IDB.
- Custom install flow: intercept `beforeinstallprompt`, show a friendly "Install to home screen" card on first visit.

---

## 6. Milestones

| # | Milestone | Contents |
|---|---|---|
| 0 | Scaffold | Vite + React + TS + Tailwind + PWA plugin; installable empty shell |
| 1 | Vault core | OPFS storage layer, data model, project/page CRUD, tree UI |
| 2 | Editor | Tiptap WYSIWYG ↔ Markdown, autosave, mobile toolbar |
| 3 | Media & links | Image insert/store/render, link handling + local link cards |
| 4 | Findability | Full-text search, quick-capture Inbox flow |
| 5 | Data safety | Export/import zip, trash, persistent-storage request, storage settings |
| 6 | Polish | Dark mode, drag-reorder, install onboarding, empty states |
| 7 | v1.1 | Web Share Target, tags, pins, templates |

---

## 7. Decisions (questions resolved 2026-07-18)
1. **OPFS-with-export is acceptable** for v1 — no Capacitor needed for now; the storage interface keeps that door open.
2. **Link cards fetch remote titles/metadata.** Fetches are best-effort: direct fetch first, then a public CORS relay; results are cached locally in IndexedDB and links always remain valid plain Markdown links if fetching fails.
3. React + TypeScript confirmed as the UI stack.
4. **Hierarchy stays strictly Projects → Pages** — simplicity is the priority; no sub-pages.
