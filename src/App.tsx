import { useEffect } from 'react'
import { useStore } from './state/store'
import EditorView from './components/EditorView'
import HomeView from './components/HomeView'
import SearchOverlay from './components/SearchOverlay'
import SettingsSheet from './components/SettingsSheet'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}

export default function App() {
  const { status, view, current, searchOpen, settingsOpen, init, setInstallPrompt } = useStore()

  useEffect(() => {
    void init()
    const onPrompt = (e: Event) => {
      e.preventDefault()
      const evt = e as BeforeInstallPromptEvent
      setInstallPrompt(() => evt.prompt())
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'loading') {
    return <div className="flex h-full items-center justify-center text-slate-400">Opening your vault…</div>
  }

  if (status === 'unsupported') {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-lg font-bold">Browser not supported</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            My Idea Vault stores your notes in on-device file storage (OPFS), which this browser doesn't
            support. Please use Chrome or Edge.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      {view === 'page' && current ? (
        <EditorView key={`${current.projectSlug}/${current.slug}`} page={current} />
      ) : (
        <HomeView />
      )}
      {searchOpen && <SearchOverlay />}
      {settingsOpen && <SettingsSheet />}
    </div>
  )
}
