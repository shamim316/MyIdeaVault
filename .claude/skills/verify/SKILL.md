---
name: verify
description: Build, serve, and drive My Idea Vault in headless Chromium to verify changes end-to-end.
---

# Verifying My Idea Vault

Static PWA (Vite + React + Tiptap + OPFS). No backend. The only surface is the
browser; OPFS requires Chromium.

## Build & serve

```bash
npm run build                              # tsc -b && vite build
npx vite preview --port 4173 --strictPort  # serve dist/ (run in background)
```

## Drive it (headless Chromium via playwright-core)

Launch with the pre-installed browser — do NOT run `playwright install`:

```js
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
})
const context = await browser.newContext({
  viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true,
})
```

Gotchas learned the hard way:

- OPFS works fine on `http://localhost` (secure context). Ephemeral per
  browser context — every run starts with a clean vault; the app auto-creates
  the Inbox project.
- The app uses `window.prompt`/`window.confirm` for project/page names and
  deletes — register a `page.on('dialog')` handler BEFORE clicking, and queue
  answers per action.
- Autosave debounce is 800 ms — `waitForTimeout(1100)` after typing before
  asserting persistence (instant back-navigation flushes via unmount, which is
  itself worth probing).
- Overlays (search, settings) sit on top of the home tree: `text=Foo`
  selectors match BOTH the overlay result and the tree row behind it. Scope to
  the overlay: `page.locator('div.fixed button', { hasText: 'Foo' })`.
- The settings Trash list loads async after the sheet opens — wait ~600 ms
  before counting items.
- Useful aria-labels: `Quick idea`, `Back`, `Search`, `Settings`, `Delete`,
  `Bold`, `Heading 2`, `Task list`, `Options for <project name>`,
  `Close settings`.
- Image insert: `setInputFiles` on `input[type=file][accept="image/*"]`, then
  assert `.tiptap img` has `naturalWidth > 0` after a reload (proves the
  OPFS→blob-URL round trip, not just the in-memory preview).
- Export: assert via `page.waitForEvent('download')`.

## Flows worth driving

Launch→Inbox visible, quick capture→type→back→listed, reload→content persists
(OPFS), bold/H2/task list survive the Markdown round trip, search, image
insert + reload, delete→Trash→restore, export zip download, dark theme toggle.
