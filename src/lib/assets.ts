import { vault } from '../vault/VaultService'

// Markdown stores images as relative paths (../assets/<hash>.<ext>) so exports
// open cleanly in any Markdown tool. In the editor those paths can't render,
// so we swap them for blob: URLs on load and swap back on save.

const blobToAsset = new Map<string, string>() // blob URL -> ../assets/name
const assetToBlob = new Map<string, string>() // `${project}|${name}` -> blob URL

const IMAGE_RE = /(!\[[^\]]*\]\()(\.\.\/assets\/([^)\s]+))(\))/g

export async function resolveAssetUrls(md: string, projectSlug: string): Promise<string> {
  const matches = [...md.matchAll(IMAGE_RE)]
  let out = md
  for (const m of matches) {
    const relPath = m[2]
    const name = m[3]
    const key = `${projectSlug}|${name}`
    let blobUrl = assetToBlob.get(key)
    if (!blobUrl) {
      try {
        const data = await vault.readAsset(projectSlug, name)
        blobUrl = URL.createObjectURL(new Blob([data as BlobPart]))
        assetToBlob.set(key, blobUrl)
        blobToAsset.set(blobUrl, relPath)
      } catch {
        continue // missing asset: leave the relative path in place
      }
    }
    out = out.split(relPath).join(blobUrl)
  }
  return out
}

export function deresolveAssetUrls(md: string): string {
  let out = md
  for (const [blobUrl, relPath] of blobToAsset) {
    out = out.split(blobUrl).join(relPath)
  }
  return out
}

export async function insertAsset(projectSlug: string, file: Blob): Promise<string> {
  const ext = (file.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png'
  const name = await vault.saveAsset(projectSlug, file, ext)
  const key = `${projectSlug}|${name}`
  let blobUrl = assetToBlob.get(key)
  if (!blobUrl) {
    blobUrl = URL.createObjectURL(file)
    assetToBlob.set(key, blobUrl)
    blobToAsset.set(blobUrl, `../assets/${name}`)
  }
  return blobUrl
}

export function releaseAssetUrls(): void {
  // Clear the maps immediately (a page opened right after gets fresh URLs) but
  // defer revocation until the editor's <img> nodes have unmounted.
  const urls = [...blobToAsset.keys()]
  blobToAsset.clear()
  assetToBlob.clear()
  setTimeout(() => {
    for (const url of urls) URL.revokeObjectURL(url)
  }, 1000)
}
