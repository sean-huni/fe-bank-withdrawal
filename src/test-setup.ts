import '@testing-library/jest-dom'

// Node 26 ships an experimental global `localStorage` that is disabled unless
// `--localstorage-file` is provided, which shadows jsdom's implementation and
// leaves `localStorage` undefined under Vitest. Provide an in-memory shim so
// zustand's `persist` middleware has a working Web Storage in tests.
if (typeof globalThis.localStorage === 'undefined') {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>()
    get length(): number { return this.store.size }
    clear(): void { this.store.clear() }
    getItem(key: string): string | null { return this.store.has(key) ? this.store.get(key)! : null }
    key(index: number): string | null { return Array.from(this.store.keys())[index] ?? null }
    removeItem(key: string): void { this.store.delete(key) }
    setItem(key: string, value: string): void { this.store.set(key, String(value)) }
  }
  const storage = new MemoryStorage()
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
  }
}
