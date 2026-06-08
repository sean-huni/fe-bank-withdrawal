import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Locale = 'en' | 'sn'
interface LocaleState { locale: Locale; setLocale: (l: Locale) => void }

export const useLocaleStore = create<LocaleState>()(
  persist((set) => ({ locale: 'en', setLocale: (locale) => set({ locale }) }),
    { name: 'atm-locale' }))
