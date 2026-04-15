export type PromptRecord = {
  id: string
  title: string
  body: string
  createdAt: number
  updatedAt: number
  lastUsedAt: number
  useCount: number
}

export type ShortcutCombo = {
  key: string
  code: string
  primaryKey?: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export type PromptSettings = {
  shortcut: ShortcutCombo
}

export const PROMPTS_STORAGE_KEY = "attestai.prompts"
export const SETTINGS_STORAGE_KEY = "attestai.settings"

export const DEFAULT_SHORTCUT: ShortcutCombo = {
  key: " ",
  code: "Space",
  primaryKey: true,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: true,
}

export const DEFAULT_SETTINGS: PromptSettings = {
  shortcut: DEFAULT_SHORTCUT,
}

type StorageArea = {
  get: (
    keys?: string | string[] | Record<string, unknown> | null,
    callback?: (items: Record<string, unknown>) => void
  ) => Promise<Record<string, unknown>> | void
  set: (
    items: Record<string, unknown>,
    callback?: () => void
  ) => Promise<void> | void
}

function getStorageArea(): StorageArea | null {
  const scope = globalThis as typeof globalThis & {
    browser?: { storage?: { local?: StorageArea } }
    chrome?: { storage?: { local?: StorageArea } }
  }

  return scope.browser?.storage?.local ?? scope.chrome?.storage?.local ?? null
}

function localStorageGet<T>(key: string, fallback: T): T {
  const rawValue = localStorage.getItem(key)

  if (!rawValue) {
    return fallback
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return fallback
  }
}

function localStorageSet<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export async function storageGet<T>(key: string, fallback: T): Promise<T> {
  const storage = getStorageArea()

  if (!storage) {
    return localStorageGet(key, fallback)
  }

  return new Promise<T>((resolve) => {
    const maybePromise = storage.get(key, (items) => {
      resolve((items[key] as T | undefined) ?? fallback)
    })

    if (maybePromise && "then" in maybePromise) {
      maybePromise.then((items) => {
        resolve((items[key] as T | undefined) ?? fallback)
      })
    }
  })
}

export async function storageSet<T>(key: string, value: T): Promise<void> {
  const storage = getStorageArea()

  if (!storage) {
    localStorageSet(key, value)
    return
  }

  return new Promise<void>((resolve) => {
    const maybePromise = storage.set({ [key]: value }, resolve)

    if (maybePromise && "then" in maybePromise) {
      maybePromise.then(resolve)
    }
  })
}

export function makePrompt(body: string): PromptRecord {
  const trimmedBody = body.trim()
  const now = Date.now()

  return {
    id: `${now}-${crypto.randomUUID()}`,
    title: createTitle(trimmedBody),
    body: trimmedBody,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    useCount: 0,
  }
}

export function createTitle(body: string): string {
  const firstLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) {
    return "Untitled prompt"
  }

  return firstLine.length > 64 ? `${firstLine.slice(0, 61)}...` : firstLine
}

export function formatShortcut(shortcut: ShortcutCombo): string {
  const parts = [
    shortcut.primaryKey ? "Ctrl/⌘" : null,
    !shortcut.primaryKey && shortcut.ctrlKey ? "Ctrl" : null,
    !shortcut.primaryKey && shortcut.metaKey ? "⌘" : null,
    shortcut.altKey ? "Alt" : null,
    shortcut.shiftKey ? "Shift" : null,
    normalizeKeyLabel(shortcut),
  ].filter(Boolean)

  return parts.join(" + ")
}

export function normalizeShortcut(shortcut?: ShortcutCombo): ShortcutCombo {
  if (!shortcut) {
    return DEFAULT_SHORTCUT
  }

  if (shortcut.primaryKey) {
    return { ...shortcut, primaryKey: true, ctrlKey: false, metaKey: false }
  }

  if (shortcut.ctrlKey !== shortcut.metaKey) {
    return { ...shortcut, primaryKey: true, ctrlKey: false, metaKey: false }
  }

  return { ...shortcut, primaryKey: false }
}

export function shortcutFromKeyboardEvent(
  event: Pick<
    KeyboardEvent,
    "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >
): ShortcutCombo | null {
  const key = event.key

  if (["Control", "Meta", "Alt", "Shift"].includes(key)) {
    return null
  }

  return {
    key,
    code: event.code,
    primaryKey: event.ctrlKey !== event.metaKey,
    ctrlKey: event.ctrlKey === event.metaKey ? event.ctrlKey : false,
    metaKey: event.ctrlKey === event.metaKey ? event.metaKey : false,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
  }
}

function normalizeKeyLabel(shortcut: ShortcutCombo): string {
  if (shortcut.code === "Space") {
    return "Space"
  }

  if (shortcut.key.length === 1) {
    return shortcut.key.toUpperCase()
  }

  return shortcut.key
}
