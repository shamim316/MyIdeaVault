import type { DirEntry, VaultStorage } from './VaultStorage'

function segments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

export class OpfsStorage implements VaultStorage {
  private rootPromise: Promise<FileSystemDirectoryHandle> | null = null

  private root(): Promise<FileSystemDirectoryHandle> {
    if (!this.rootPromise) this.rootPromise = navigator.storage.getDirectory()
    return this.rootPromise
  }

  private async dirHandle(path: string, create: boolean): Promise<FileSystemDirectoryHandle> {
    let dir = await this.root()
    for (const seg of segments(path)) {
      dir = await dir.getDirectoryHandle(seg, { create })
    }
    return dir
  }

  private async fileHandle(path: string, create: boolean): Promise<FileSystemFileHandle> {
    const segs = segments(path)
    const name = segs.pop()
    if (!name) throw new Error(`Invalid file path: ${path}`)
    const dir = await this.dirHandle(segs.join('/'), create)
    return dir.getFileHandle(name, { create })
  }

  async readFile(path: string): Promise<Uint8Array> {
    const handle = await this.fileHandle(path, false)
    const file = await handle.getFile()
    return new Uint8Array(await file.arrayBuffer())
  }

  async readText(path: string): Promise<string> {
    const handle = await this.fileHandle(path, false)
    const file = await handle.getFile()
    return file.text()
  }

  async writeFile(path: string, data: Uint8Array | Blob): Promise<void> {
    const handle = await this.fileHandle(path, true)
    const writable = await handle.createWritable()
    const payload = data instanceof Blob ? data : new Blob([data as BlobPart])
    await writable.write(payload)
    await writable.close()
  }

  async writeText(path: string, text: string): Promise<void> {
    await this.writeFile(path, new TextEncoder().encode(text))
  }

  async deleteFile(path: string): Promise<void> {
    const segs = segments(path)
    const name = segs.pop()
    if (!name) throw new Error(`Invalid file path: ${path}`)
    const dir = await this.dirHandle(segs.join('/'), false)
    await dir.removeEntry(name)
  }

  async deleteDir(path: string): Promise<void> {
    const segs = segments(path)
    const name = segs.pop()
    if (!name) throw new Error(`Invalid directory path: ${path}`)
    const dir = await this.dirHandle(segs.join('/'), false)
    await dir.removeEntry(name, { recursive: true })
  }

  async list(path: string): Promise<DirEntry[]> {
    try {
      const dir = await this.dirHandle(path, false)
      const out: DirEntry[] = []
      for await (const [name, handle] of dir.entries()) {
        out.push({ name, kind: handle.kind })
      }
      return out
    } catch {
      return []
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.fileHandle(path, false)
      return true
    } catch {
      try {
        await this.dirHandle(path, false)
        return true
      } catch {
        return false
      }
    }
  }

  async ensureDir(path: string): Promise<void> {
    await this.dirHandle(path, true)
  }
}
