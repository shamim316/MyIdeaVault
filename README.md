# My Idea Vault

Friction-free, local-first idea capture for Android, built as a Progressive Web
App. Notes are Markdown files stored on your device (OPFS) — no account, no
cloud, no server.

- **Projects → Pages** hierarchy, visible on launch
- **WYSIWYG editor** (Tiptap) that reads/writes clean Markdown
- **Images** saved into the vault; **links** get locally-cached title cards
- **Quick capture** into an Inbox project
- **Full-text search**, pinned pages, trash with 30-day recovery
- **Export/import** the whole vault as a zip of Markdown + images
- Installable, fully offline PWA

See [PLAN.md](PLAN.md) for the product and technical plan.

## Development

```bash
npm install
npm run dev        # dev server
npm run build      # typecheck + production build (dist/)
npm run preview    # serve the production build
```

Requires Node 20+. Use Chrome/Edge — the app depends on OPFS
(`navigator.storage.getDirectory`).

## Deploying

The build output in `dist/` is fully static. Host it on any static host with
HTTPS (GitHub Pages, Netlify, Cloudflare Pages…). On Android, open the site in
Chrome and choose **Install app** (or use the in-app install button in
Settings).
