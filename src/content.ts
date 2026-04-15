type PromptRecord = {
  id: string
  title: string
  body: string
  createdAt: number
  updatedAt: number
  lastUsedAt: number
  useCount: number
}

type ShortcutCombo = {
  key: string
  code: string
  primaryKey?: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

type PromptSettings = {
  shortcut: ShortcutCombo
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

type StorageChange = {
  newValue?: unknown
}

type ExtensionStorage = {
  local?: StorageArea
  onChanged?: {
    addListener: (
      callback: (
        changes: Record<string, StorageChange>,
        areaName: string
      ) => void
    ) => void
  }
}

type RuntimeApi = {
  onMessage?: {
    addListener: (
      callback: (
        message: unknown,
        sender: unknown,
        sendResponse: (response?: unknown) => void
      ) => boolean | void
    ) => void
  }
}

const PROMPTS_STORAGE_KEY = "attestai.prompts"
const SETTINGS_STORAGE_KEY = "attestai.settings"
const RUN_PROMPT_FLOW_MESSAGE = "attestai.runPromptFlow"
const DEFAULT_SETTINGS: PromptSettings = {
  shortcut: {
    key: " ",
    code: "Space",
    primaryKey: true,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: true,
  },
}

let pickerHost: HTMLDivElement | null = null
let toastTimer = 0
let currentSettings = DEFAULT_SETTINGS

function getStorageArea(): StorageArea | null {
  const scope = globalThis as typeof globalThis & {
    browser?: { storage?: ExtensionStorage }
    chrome?: { storage?: ExtensionStorage }
  }

  return scope.browser?.storage?.local ?? scope.chrome?.storage?.local ?? null
}

function getExtensionStorage(): ExtensionStorage | null {
  const scope = globalThis as typeof globalThis & {
    browser?: { storage?: ExtensionStorage }
    chrome?: { storage?: ExtensionStorage }
  }

  return scope.browser?.storage ?? scope.chrome?.storage ?? null
}

function getRuntimeApi(): RuntimeApi | null {
  const scope = globalThis as typeof globalThis & {
    browser?: { runtime?: RuntimeApi }
    chrome?: { runtime?: RuntimeApi }
  }

  return scope.browser?.runtime ?? scope.chrome?.runtime ?? null
}

async function storageGet<T>(key: string, fallback: T): Promise<T> {
  const storage = getStorageArea()

  if (!storage) {
    return fallback
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

async function storageSet<T>(key: string, value: T): Promise<void> {
  const storage = getStorageArea()

  if (!storage) {
    return
  }

  return new Promise<void>((resolve) => {
    const maybePromise = storage.set({ [key]: value }, resolve)

    if (maybePromise && "then" in maybePromise) {
      maybePromise.then(resolve)
    }
  })
}

function createTitle(body: string): string {
  const firstLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) {
    return "Untitled prompt"
  }

  return firstLine.length > 64 ? `${firstLine.slice(0, 61)}...` : firstLine
}

function makePrompt(body: string): PromptRecord {
  const now = Date.now()

  return {
    id: `${now}-${crypto.randomUUID()}`,
    title: createTitle(body),
    body,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    useCount: 0,
  }
}

function isShortcutMatch(event: KeyboardEvent, shortcut: ShortcutCombo) {
  if (shortcut.primaryKey) {
    return (
      event.code === shortcut.code &&
      event.ctrlKey !== event.metaKey &&
      (event.ctrlKey || event.metaKey) &&
      event.altKey === shortcut.altKey &&
      event.shiftKey === shortcut.shiftKey
    )
  }

  return (
    event.code === shortcut.code &&
    event.ctrlKey === shortcut.ctrlKey &&
    event.metaKey === shortcut.metaKey &&
    event.altKey === shortcut.altKey &&
    event.shiftKey === shortcut.shiftKey
  )
}

function normalizeShortcut(shortcut?: ShortcutCombo): ShortcutCombo {
  if (!shortcut) {
    return DEFAULT_SETTINGS.shortcut
  }

  if (shortcut.primaryKey) {
    return { ...shortcut, primaryKey: true, ctrlKey: false, metaKey: false }
  }

  if (shortcut.ctrlKey !== shortcut.metaKey) {
    return { ...shortcut, primaryKey: true, ctrlKey: false, metaKey: false }
  }

  return { ...shortcut, primaryKey: false }
}

function getDeepActiveElement(root: Document | ShadowRoot): Element | null {
  let activeElement = root.activeElement

  while (activeElement?.shadowRoot?.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement
  }

  return activeElement
}

function getEditableTargetFromElement(
  element: Element | null
): HTMLElement | null {
  if (!element || !(element instanceof HTMLElement)) {
    return null
  }

  const editableTarget = element.closest<HTMLElement>(
    "input, textarea, [contenteditable], [role='textbox']"
  )

  if (
    editableTarget &&
    (!(editableTarget instanceof HTMLInputElement) ||
      ![
        "button",
        "checkbox",
        "color",
        "file",
        "hidden",
        "image",
        "radio",
        "range",
        "reset",
        "submit",
      ].includes(editableTarget.type))
  ) {
    return editableTarget
  }

  if (!element.isContentEditable) {
    return null
  }

  return element
}

function getEditableTarget(): HTMLElement | null {
  return getEditableTargetFromElement(getDeepActiveElement(document))
}

function getSelectionText() {
  return window.getSelection()?.toString().trim() ?? ""
}

async function saveSelection(selectionText: string) {
  const prompts = await storageGet<PromptRecord[]>(PROMPTS_STORAGE_KEY, [])
  const nextPrompts = [makePrompt(selectionText), ...prompts].sort(
    (a, b) => b.lastUsedAt - a.lastUsedAt
  )

  await storageSet(PROMPTS_STORAGE_KEY, nextPrompts)
  showToast("Prompt saved")
}

async function markPromptUsed(prompt: PromptRecord) {
  const prompts = await storageGet<PromptRecord[]>(PROMPTS_STORAGE_KEY, [])
  const now = Date.now()
  const nextPrompts = prompts
    .map((storedPrompt) =>
      storedPrompt.id === prompt.id
        ? {
            ...storedPrompt,
            lastUsedAt: now,
            useCount: storedPrompt.useCount + 1,
          }
        : storedPrompt
    )
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)

  await storageSet(PROMPTS_STORAGE_KEY, nextPrompts)
}

function pasteIntoTarget(target: HTMLElement, text: string) {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    const start = target.selectionStart ?? target.value.length
    const end = target.selectionEnd ?? target.value.length

    target.setRangeText(text, start, end, "end")
    target.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }))
    target.dispatchEvent(new Event("change", { bubbles: true }))
    target.focus()
    return
  }

  target.focus()

  const selection = window.getSelection()
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null

  if (range) {
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    range.collapse(false)
    selection?.removeAllRanges()
    selection?.addRange(range)
  } else {
    target.append(document.createTextNode(text))
  }

  target.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }))
}

function getAnchorRect(target: HTMLElement) {
  const rect = target.getBoundingClientRect()

  if (rect.width || rect.height) {
    return rect
  }

  return new DOMRect(window.innerWidth / 2 - 160, 120, 320, 1)
}

function closePicker() {
  pickerHost?.remove()
  pickerHost = null
}

function showPicker(target: HTMLElement, prompts: PromptRecord[]) {
  closePicker()

  const sortedPrompts = [...prompts].sort((a, b) => b.lastUsedAt - a.lastUsedAt)

  const anchor = getAnchorRect(target)
  const host = document.createElement("div")
  const shadow = host.attachShadow({ mode: "open" })

  host.style.position = "fixed"
  host.style.zIndex = "2147483647"
  host.style.left = `${Math.min(anchor.left, window.innerWidth - 340)}px`
  host.style.top = `${Math.min(anchor.bottom + 8, window.innerHeight - 300)}px`

  shadow.innerHTML = `
    <style>
      :host { all: initial; color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .panel { width: 320px; max-width: calc(100vw - 24px); overflow: hidden; border: 1px solid hsl(240 5.9% 90%); border-radius: 8px; background: white; color: hsl(240 10% 3.9%); box-shadow: 0 18px 50px rgb(0 0 0 / 18%); }
      .search { box-sizing: border-box; width: 100%; height: 40px; border: 0; border-bottom: 1px solid hsl(240 5.9% 90%); outline: none; padding: 0 12px; font: inherit; font-size: 13px; }
      .list { max-height: 240px; overflow: auto; padding: 6px; }
      .item { box-sizing: border-box; width: 100%; border: 0; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; display: grid; gap: 2px; padding: 8px; text-align: left; }
      .item[aria-selected="true"], .item:hover { background: hsl(240 4.8% 95.9%); }
      .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
      .body { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: hsl(240 3.8% 46.1%); font-size: 12px; line-height: 1.35; }
      .empty { color: hsl(240 3.8% 46.1%); font-size: 13px; padding: 18px; text-align: center; }
    </style>
    <div class="panel" role="dialog" aria-label="Saved prompts">
      <input class="search" type="text" placeholder="Search prompts" aria-label="Search prompts" />
      <div class="list" role="listbox"></div>
    </div>
  `

  document.documentElement.append(host)
  pickerHost = host

  const search = shadow.querySelector<HTMLInputElement>(".search")
  const list = shadow.querySelector<HTMLDivElement>(".list")
  let selectedIndex = 0
  let filteredPrompts = sortedPrompts

  if (!search || !list) {
    closePicker()
    return
  }

  const listElement = list

  function choosePrompt(prompt: PromptRecord) {
    pasteIntoTarget(target, prompt.body)
    void markPromptUsed(prompt)
    closePicker()
    target.focus()
  }

  function renderList() {
    listElement.innerHTML = ""

    if (!filteredPrompts.length) {
      const empty = document.createElement("div")
      empty.className = "empty"
      empty.textContent = sortedPrompts.length
        ? "No matching prompts"
        : "No saved prompts yet"
      listElement.append(empty)
      return
    }

    filteredPrompts.forEach((prompt, index) => {
      const item = document.createElement("button")
      const title = document.createElement("span")
      const body = document.createElement("span")

      item.type = "button"
      item.className = "item"
      item.setAttribute("role", "option")
      item.setAttribute("aria-selected", String(index === selectedIndex))
      title.className = "title"
      title.textContent = prompt.title
      body.className = "body"
      body.textContent = prompt.body
      item.append(title, body)
      item.addEventListener("mouseenter", () => {
        selectedIndex = index
        renderList()
      })
      item.addEventListener("click", () => choosePrompt(prompt))
      listElement.append(item)
    })
  }

  search.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase()
    filteredPrompts = sortedPrompts.filter((prompt) =>
      `${prompt.title} ${prompt.body}`.toLowerCase().includes(query)
    )
    selectedIndex = 0
    renderList()
  })

  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault()
      closePicker()
      target.focus()
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      selectedIndex = Math.min(selectedIndex + 1, filteredPrompts.length - 1)
      renderList()
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      selectedIndex = Math.max(selectedIndex - 1, 0)
      renderList()
      return
    }

    if (event.key === "Enter" && filteredPrompts[selectedIndex]) {
      event.preventDefault()
      choosePrompt(filteredPrompts[selectedIndex])
    }
  })

  window.addEventListener("pointerdown", handleOutsidePointerDown, {
    capture: true,
    once: true,
  })

  renderList()
  search.focus()
}

function handleOutsidePointerDown(event: PointerEvent) {
  if (pickerHost && event.composedPath().includes(pickerHost)) {
    window.addEventListener("pointerdown", handleOutsidePointerDown, {
      capture: true,
      once: true,
    })
    return
  }

  closePicker()
}

function showToast(message: string) {
  const existingToast = document.getElementById("attestai-toast")

  existingToast?.remove()
  window.clearTimeout(toastTimer)

  const toast = document.createElement("div")

  toast.id = "attestai-toast"
  toast.textContent = message
  toast.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "right:16px",
    "bottom:16px",
    "border:1px solid rgb(228 228 231)",
    "border-radius:8px",
    "background:white",
    "color:rgb(24 24 27)",
    "box-shadow:0 12px 30px rgb(0 0 0 / 16%)",
    "font:13px ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "padding:10px 12px",
  ].join(";")

  document.documentElement.append(toast)
  toastTimer = window.setTimeout(() => toast.remove(), 1800)
}

function hasFocusedChildFrame() {
  return (
    document.activeElement instanceof HTMLIFrameElement ||
    document.activeElement instanceof HTMLFrameElement
  )
}

function isRunPromptFlowMessage(message: unknown) {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === RUN_PROMPT_FLOW_MESSAGE
  )
}

async function runPromptFlow() {
  const editableTarget = getEditableTarget()

  if (editableTarget) {
    const prompts = await storageGet<PromptRecord[]>(PROMPTS_STORAGE_KEY, [])
    showPicker(editableTarget, prompts)
    return
  }

  const selectedText = getSelectionText()

  if (!selectedText) {
    showToast("Select text or focus a textbox")
    return
  }

  await saveSelection(selectedText)
}

async function handleShortcut(event: KeyboardEvent) {
  if (event.repeat) {
    return
  }

  if (!isShortcutMatch(event, currentSettings.shortcut)) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  await runPromptFlow()
}

document.addEventListener(
  "keydown",
  (event) => {
    void handleShortcut(event)
  },
  true
)

getRuntimeApi()?.onMessage?.addListener((message, _sender, sendResponse) => {
  if (!isRunPromptFlowMessage(message)) {
    return false
  }

  if (!document.hasFocus() || hasFocusedChildFrame()) {
    sendResponse({ handled: false })
    return false
  }

  void runPromptFlow()
    .then(() => {
      sendResponse({ handled: true })
    })
    .catch(() => {
      sendResponse({ handled: false })
    })

  return true
})

void storageGet<PromptSettings>(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS).then(
  (settings) => {
    currentSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      shortcut: normalizeShortcut(settings.shortcut),
    }
  }
)

getExtensionStorage()?.onChanged?.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return
  }

  const nextSettings = changes[SETTINGS_STORAGE_KEY]?.newValue

  if (nextSettings) {
    const settings = nextSettings as PromptSettings

    currentSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      shortcut: normalizeShortcut(settings.shortcut),
    }
  }
})
