import Dexie, { type EntityTable } from 'dexie'

// Derived/cache data only — OPFS is the source of truth for the vault itself.
export interface LinkCard {
  url: string
  title: string
  description: string
  fetchedAt: number
  failed: boolean
}

const db = new Dexie('idea-vault-cache') as Dexie & {
  linkCards: EntityTable<LinkCard, 'url'>
}

db.version(1).stores({
  linkCards: 'url',
})

export { db }
