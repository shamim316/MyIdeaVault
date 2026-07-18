import JSZip from 'jszip'
import { vault } from '../vault/VaultService'
import { PROJECTS_DIR, VAULT_ROOT } from '../vault/model'

async function addDirToZip(zip: JSZip, dirPath: string, zipPath: string): Promise<void> {
  for (const entry of await vault.storage.list(dirPath)) {
    const childPath = `${dirPath}/${entry.name}`
    const childZip = zipPath ? `${zipPath}/${entry.name}` : entry.name
    if (entry.kind === 'directory') {
      await addDirToZip(zip, childPath, childZip)
    } else {
      zip.file(childZip, await vault.storage.readFile(childPath))
    }
  }
}

export async function exportVaultZip(): Promise<void> {
  const zip = new JSZip()
  await addDirToZip(zip, PROJECTS_DIR, 'projects')
  const blob = await zip.generateAsync({ type: 'blob' })
  const date = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `idea-vault-${date}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000)
}

export async function importVaultZip(file: File): Promise<number> {
  const zip = await JSZip.loadAsync(file)
  let imported = 0
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const clean = path.replace(/^\/+/, '')
    if (!clean.startsWith('projects/') || clean.includes('..')) continue
    const data = await entry.async('uint8array')
    await vault.storage.writeFile(`${VAULT_ROOT}/${clean}`, data)
    imported++
  }
  return imported
}

export async function sharePageAsMarkdown(title: string, markdown: string): Promise<void> {
  const fileName = `${title.replace(/[^\w\s-]/g, '').trim() || 'idea'}.md`
  const file = new File([markdown], fileName, { type: 'text/markdown' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title })
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000)
}
