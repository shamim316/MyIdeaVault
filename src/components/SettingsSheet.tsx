import { useEffect, useRef, useState } from 'react'
import { exportVaultZip, importVaultZip } from '../lib/zip'
import { useStore, type Theme } from '../state/store'
import { BackIcon } from './icons'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

export default function SettingsSheet() {
  const { setSettingsOpen, theme, setTheme, trash, restoreFromTrash, deleteFromTrash, refresh, installPrompt } =
    useStore()
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage({ usage: e.usage ?? 0, quota: e.quota ?? 0 }))
      .catch(() => {})
    navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => {})
  }, [])

  const section = 'mt-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
  const button =
    'rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl px-4 pb-16">
        <div className="flex items-center gap-1 pt-3">
          <button
            onClick={() => setSettingsOpen(false)}
            aria-label="Close settings"
            className="-ml-2 rounded-xl p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <BackIcon />
          </button>
          <h2 className="text-lg font-bold">Settings</h2>
        </div>

        {installPrompt && (
          <section className={section}>
            <h3 className="font-semibold">Install app</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Add My Idea Vault to your home screen for a full-screen, offline experience.
            </p>
            <button className={`${button} mt-3 bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-600 dark:hover:bg-indigo-500`} onClick={() => void installPrompt()}>
              Install
            </button>
          </section>
        )}

        <section className={section}>
          <h3 className="font-semibold">Appearance</h3>
          <div className="mt-3 flex gap-2">
            {(['system', 'light', 'dark'] as Theme[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-xl px-4 py-2 text-sm font-medium capitalize ${
                  theme === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <section className={section}>
          <h3 className="font-semibold">Storage</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Your vault lives entirely on this device, in this browser's storage.
            {persisted === true && ' Storage is marked persistent — the browser won’t evict it.'}
            {persisted === false &&
              ' Storage is not yet marked persistent; the browser could clear it under storage pressure. Export backups regularly.'}
          </p>
          {usage && (
            <p className="mt-2 text-sm">
              Used: <b>{formatBytes(usage.usage)}</b> of {formatBytes(usage.quota)} available
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={button}
              onClick={async () => {
                setBusy('export')
                try {
                  await exportVaultZip()
                } finally {
                  setBusy('')
                }
              }}
              disabled={busy !== ''}
            >
              {busy === 'export' ? 'Exporting…' : 'Export vault (.zip)'}
            </button>
            <button className={button} onClick={() => importRef.current?.click()} disabled={busy !== ''}>
              {busy === 'import' ? 'Importing…' : 'Import vault (.zip)'}
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".zip,application/zip"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                setBusy('import')
                try {
                  const n = await importVaultZip(file)
                  await refresh()
                  window.alert(`Imported ${n} file${n === 1 ? '' : 's'}.`)
                } catch {
                  window.alert('Import failed — is this an Idea Vault export zip?')
                } finally {
                  setBusy('')
                }
              }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Exports are plain Markdown + images — they open in Obsidian, VS Code, or any Markdown app.
          </p>
        </section>

        <section className={section}>
          <h3 className="font-semibold">Trash</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Deleted pages are kept for 30 days, then removed automatically.
          </p>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {trash.map((item) => (
              <li key={item.fileName} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-slate-400">
                    from {item.originProjectName || 'unknown'} ·{' '}
                    {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : ''}
                  </p>
                </div>
                <button
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                  onClick={() => void restoreFromTrash(item.fileName)}
                >
                  Restore
                </button>
                <button
                  className="rounded-lg px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  onClick={() => {
                    if (window.confirm(`Permanently delete "${item.title}"?`)) void deleteFromTrash(item.fileName)
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
            {trash.length === 0 && <li className="py-2 text-sm text-slate-400">Trash is empty</li>}
          </ul>
        </section>

        <p className="mt-8 text-center text-xs text-slate-400">
          My Idea Vault · local-first · no account, no cloud
        </p>
      </div>
    </div>
  )
}
