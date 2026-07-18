// All file I/O goes through this interface. v1 ships OpfsStorage; a future
// Capacitor build swaps in a native-filesystem implementation with no other
// code changes.
export interface DirEntry {
  name: string
  kind: 'file' | 'directory'
}

export interface VaultStorage {
  readFile(path: string): Promise<Uint8Array>
  readText(path: string): Promise<string>
  writeFile(path: string, data: Uint8Array | Blob): Promise<void>
  writeText(path: string, text: string): Promise<void>
  deleteFile(path: string): Promise<void>
  deleteDir(path: string): Promise<void>
  list(path: string): Promise<DirEntry[]>
  exists(path: string): Promise<boolean>
  ensureDir(path: string): Promise<void>
}
