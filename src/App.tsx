import { AppRoutes } from './router'
import { DevBanner } from './components/DevBanner'
import { LanguageToggle } from './components/LanguageToggle'

export function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute top-3 right-3">
        <LanguageToggle />
      </div>
      <main className="w-full max-w-md">
        <AppRoutes />
      </main>
      <DevBanner />
    </div>
  )
}
