import * as React from "react"
import {
  Edit3Icon,
  KeyboardIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  DEFAULT_SETTINGS,
  PROMPTS_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  createTitle,
  formatShortcut,
  makePrompt,
  shortcutFromKeyboardEvent,
  storageGet,
  storageSet,
} from "@/lib/prompt-storage"
import type { PromptRecord, PromptSettings } from "@/lib/prompt-storage"

type EditorState = {
  id: string | null
  title: string
  body: string
}

const EMPTY_EDITOR: EditorState = {
  id: null,
  title: "",
  body: "",
}

function sortPrompts(prompts: PromptRecord[]) {
  return [...prompts].sort((a, b) => b.lastUsedAt - a.lastUsedAt)
}

export function App() {
  const [prompts, setPrompts] = React.useState<PromptRecord[]>([])
  const [settings, setSettings] =
    React.useState<PromptSettings>(DEFAULT_SETTINGS)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isCapturingShortcut, setIsCapturingShortcut] = React.useState(false)
  const [editor, setEditor] = React.useState<EditorState>(EMPTY_EDITOR)
  const [isEditorOpen, setIsEditorOpen] = React.useState(false)

  React.useEffect(() => {
    async function loadState() {
      const [storedPrompts, storedSettings] = await Promise.all([
        storageGet<PromptRecord[]>(PROMPTS_STORAGE_KEY, []),
        storageGet<PromptSettings>(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS),
      ])

      setPrompts(sortPrompts(storedPrompts))
      setSettings({ ...DEFAULT_SETTINGS, ...storedSettings })
      setIsLoading(false)
    }

    void loadState()
  }, [])

  async function persistPrompts(nextPrompts: PromptRecord[]) {
    const sortedPrompts = sortPrompts(nextPrompts)

    setPrompts(sortedPrompts)
    await storageSet(PROMPTS_STORAGE_KEY, sortedPrompts)
  }

  async function persistSettings(nextSettings: PromptSettings) {
    setSettings(nextSettings)
    await storageSet(SETTINGS_STORAGE_KEY, nextSettings)
  }

  function openNewPrompt() {
    setEditor(EMPTY_EDITOR)
    setIsEditorOpen(true)
  }

  function openExistingPrompt(prompt: PromptRecord) {
    setEditor({
      id: prompt.id,
      title: prompt.title,
      body: prompt.body,
    })
    setIsEditorOpen(true)
  }

  async function saveEditor() {
    const trimmedBody = editor.body.trim()

    if (!trimmedBody) {
      return
    }

    const now = Date.now()
    const title = editor.title.trim() || createTitle(trimmedBody)

    if (editor.id) {
      await persistPrompts(
        prompts.map((prompt) =>
          prompt.id === editor.id
            ? {
                ...prompt,
                title,
                body: trimmedBody,
                updatedAt: now,
              }
            : prompt
        )
      )
    } else {
      await persistPrompts([{ ...makePrompt(trimmedBody), title }, ...prompts])
    }

    setIsEditorOpen(false)
    setEditor(EMPTY_EDITOR)
  }

  async function deletePrompt(id: string) {
    await persistPrompts(prompts.filter((prompt) => prompt.id !== id))
  }

  async function handleShortcutCapture(event: React.KeyboardEvent) {
    event.preventDefault()
    event.stopPropagation()

    const shortcut = shortcutFromKeyboardEvent(event.nativeEvent)

    if (!shortcut) {
      return
    }

    await persistSettings({ ...settings, shortcut })
    setIsCapturingShortcut(false)
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit rounded-md">
              Prompt Paster
            </Badge>
            <div className="space-y-1">
              <h1 className="text-2xl font-medium tracking-normal">
                Saved prompts and shortcut
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Select page text to save it. Focus a textbox to paste a saved
                prompt.
              </p>
            </div>
          </div>
          <Button onClick={openNewPrompt}>
            <PlusIcon />
            New prompt
          </Button>
        </header>

        <section className="grid gap-4 rounded-lg border bg-card p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyboardIcon className="size-4" />
              <h2 className="font-medium">Shortcut</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              This shortcut is handled inside pages where the content script is
              allowed to run.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shortcut">Keyboard shortcut</Label>
            <Input
              id="shortcut"
              readOnly
              aria-label="Keyboard shortcut"
              value={
                isCapturingShortcut
                  ? "Press keys..."
                  : formatShortcut(settings.shortcut)
              }
              onFocus={() => setIsCapturingShortcut(true)}
              onClick={() => setIsCapturingShortcut(true)}
              onKeyDown={handleShortcutCapture}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              Click the field, then press the combo you want.
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="rounded-lg border bg-card p-2 shadow-sm">
            <Command shouldFilter>
              <CommandInput placeholder="Search saved prompts" />
              <CommandList>
                <CommandEmpty>
                  {isLoading ? "Loading prompts..." : "No prompts saved."}
                </CommandEmpty>
                <CommandGroup heading="Recently used">
                  {prompts.map((prompt) => (
                    <CommandItem
                      key={prompt.id}
                      value={`${prompt.title} ${prompt.body}`}
                      onSelect={() => openExistingPrompt(prompt)}
                    >
                      <span className="line-clamp-1 min-w-0">
                        {prompt.title}
                      </span>
                      <Badge
                        variant="outline"
                        className="ml-auto rounded-md tabular-nums"
                      >
                        {prompt.useCount}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>

          <div className="rounded-lg border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 p-4">
              <div>
                <h2 className="font-medium">Saved prompts</h2>
                <p className="text-sm text-muted-foreground">
                  Edit, remove, or add reusable text.
                </p>
              </div>
              <Badge variant="outline" className="rounded-md">
                {prompts.length}
              </Badge>
            </div>
            <Separator />
            <ScrollArea className="h-[28rem]">
              <div className="divide-y">
                {prompts.map((prompt) => (
                  <article key={prompt.id} className="grid gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <h3 className="line-clamp-1 font-medium">
                          {prompt.title}
                        </h3>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {prompt.body}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${prompt.title}`}
                          onClick={() => openExistingPrompt(prompt)}
                        >
                          <Edit3Icon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${prompt.title}`}
                          onClick={() => void deletePrompt(prompt.id)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Used {prompt.useCount} times</span>
                      <span>
                        Updated {new Date(prompt.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </article>
                ))}
                {!prompts.length && !isLoading ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    Saved page selections will appear here.
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        </section>
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editor.id ? "Edit prompt" : "New prompt"}
            </DialogTitle>
            <DialogDescription>
              Keep the title short so it scans quickly in the paste menu.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="prompt-title">Title</Label>
              <Input
                id="prompt-title"
                value={editor.title}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Optional title"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prompt-body">Prompt</Label>
              <Textarea
                id="prompt-body"
                value={editor.body}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    body: event.target.value,
                  }))
                }
                placeholder="Write or paste prompt text"
                className="min-h-40"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditorOpen(false)
                setEditor(EMPTY_EDITOR)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void saveEditor()}
              disabled={!editor.body.trim()}
            >
              <SaveIcon />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

export default App
