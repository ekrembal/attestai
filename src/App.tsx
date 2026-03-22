import { useEffect, useRef, useState } from "react"
import JSZip from "jszip"
import {
  AlertCircleIcon,
  DownloadIcon,
  FileArchiveIcon,
  ImagePlusIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  Trash2Icon,
  WandSparklesIcon,
} from "lucide-react"

import {
  ACCEPTED_IMAGE_TYPES,
  detectFormatSupport,
  formatBytes,
  formatDimensions,
  getSizeDeltaLabel,
  processImage,
  readImageMetadata,
  type OutputFormat,
  type ProcessSettings,
} from "@/lib/image-tools"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ImageItem = {
  id: string
  file: File
  sourceUrl: string
  width: number
  height: number
  processed?: {
    blob: Blob
    url: string
    width: number
    height: number
    fileName: string
    mimeType: string
  }
  status: "ready" | "processing" | "done" | "error"
  error?: string
}

type AppSettings = {
  format: OutputFormat
  quality: number
  resizeEnabled: boolean
  width: string
  height: string
  keepAspectRatio: boolean
  preventUpscale: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  format: "webp",
  quality: 82,
  resizeEnabled: false,
  width: "1600",
  height: "1600",
  keepAspectRatio: true,
  preventUpscale: true,
} as const

const FORMAT_OPTIONS: { value: OutputFormat; label: string }[] = [
  { value: "webp", label: "WebP" },
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPG" },
  { value: "avif", label: "AVIF" },
]

function App() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const itemsRef = useRef<ImageItem[]>([])
  const [items, setItems] = useState<ImageItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [formatSupport, setFormatSupport] = useState<Record<OutputFormat, boolean>>({
    webp: true,
    png: true,
    jpeg: true,
    avif: true,
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [progressValue, setProgressValue] = useState(0)
  const [compareValue, setCompareValue] = useState<number[]>([50])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    detectFormatSupport()
      .then(setFormatSupport)
      .catch(() => {
        setFormatSupport({
          webp: true,
          png: true,
          jpeg: true,
          avif: false,
        })
      })
  }, [])

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.sourceUrl)
        if (item.processed) {
          URL.revokeObjectURL(item.processed.url)
        }
      }
    }
  }, [])

  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null
  const processedCount = items.filter((item) => item.processed).length
  const totalOriginalBytes = items.reduce((sum, item) => sum + item.file.size, 0)
  const totalProcessedBytes = items.reduce((sum, item) => sum + (item.processed?.blob.size ?? 0), 0)
  const queueHasErrors = items.some((item) => item.status === "error")
  const qualityDisabled = settings.format === "png"

  async function handleIncomingFiles(fileList: FileList | File[]) {
    const nextFiles = Array.from(fileList)
    if (nextFiles.length === 0) {
      return
    }

    setErrorMessage(null)

    const validFiles: ImageItem[] = []
    const errors: string[] = []

    for (const file of nextFiles) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        errors.push(`${file.name}: use PNG, JPG, WebP, or AVIF files.`)
        continue
      }

      try {
        const metadata = await readImageMetadata(file)
        validFiles.push({
          id: crypto.randomUUID(),
          file,
          sourceUrl: metadata.objectUrl,
          width: metadata.width,
          height: metadata.height,
          status: "ready",
        })
      } catch (error) {
        errors.push(
          `${file.name}: ${error instanceof Error ? error.message : "The file could not be opened."}`,
        )
      }
    }

    if (validFiles.length > 0) {
      setItems((current) => [...current, ...validFiles])
      setSelectedId((current) => current ?? validFiles[0].id)
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join(" "))
    }
  }

  async function handleProcessBatch() {
    if (items.length === 0) {
      setErrorMessage("Add at least one image before processing.")
      return
    }

    const parsedSettings = getValidatedSettings(settings, formatSupport)
    if ("error" in parsedSettings) {
      setErrorMessage(parsedSettings.error)
      return
    }

    setErrorMessage(null)
    setIsProcessing(true)
    setProgressValue(0)

    for (const [index, item] of items.entries()) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: "processing", error: undefined }
            : entry,
        ),
      )

      try {
        const processed = await processImage(
          item.file,
          item.width,
          item.height,
          parsedSettings,
        )
        const processedUrl = URL.createObjectURL(processed.blob)

        setItems((current) =>
          current.map((entry) => {
            if (entry.id !== item.id) {
              return entry
            }

            if (entry.processed) {
              URL.revokeObjectURL(entry.processed.url)
            }

            return {
              ...entry,
              status: "done",
              error: undefined,
              processed: {
                blob: processed.blob,
                url: processedUrl,
                width: processed.width,
                height: processed.height,
                fileName: processed.fileName,
                mimeType: processed.mimeType,
              },
            }
          }),
        )
      } catch (error) {
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? {
                  ...entry,
                  status: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "The image could not be processed.",
                }
              : entry,
          ),
        )
      }

      setProgressValue(Math.round(((index + 1) / items.length) * 100))
    }

    setIsProcessing(false)
  }

  async function handleDownloadAll() {
    const processedItems = items.filter((item) => item.processed)
    if (processedItems.length === 0) {
      setErrorMessage("Process the queue before exporting files.")
      return
    }

    setIsExporting(true)
    setErrorMessage(null)

    try {
      if (processedItems.length === 1) {
        const processed = processedItems[0].processed!
        downloadBlob(processed.blob, processed.fileName)
      } else {
        const zip = new JSZip()

        for (const item of processedItems) {
          zip.file(item.processed!.fileName, item.processed!.blob)
        }

        const archive = await zip.generateAsync({ type: "blob" })
        downloadBlob(archive, "image-tools-export.zip")
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The export could not be created.",
      )
    } finally {
      setIsExporting(false)
    }
  }

  function handleRemove(id: string) {
    setItems((current) => {
      const itemToRemove = current.find((item) => item.id === id)
      if (itemToRemove) {
        URL.revokeObjectURL(itemToRemove.sourceUrl)
        if (itemToRemove.processed) {
          URL.revokeObjectURL(itemToRemove.processed.url)
        }
      }

      const nextItems = current.filter((item) => item.id !== id)
      if (selectedId === id) {
        setSelectedId(nextItems[0]?.id ?? null)
      }

      return nextItems
    })
  }

  function handleClearAll() {
    for (const item of items) {
      URL.revokeObjectURL(item.sourceUrl)
      if (item.processed) {
        URL.revokeObjectURL(item.processed.url)
      }
    }

    setItems([])
    setSelectedId(null)
    setProgressValue(0)
    setErrorMessage(null)
  }

  function openFilePicker() {
    inputRef.current?.click()
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(201,214,197,0.45),_transparent_30%),linear-gradient(180deg,_#f5f1e8_0%,_#fbfaf7_32%,_#ffffff_100%)] px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <section className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <Card className="border-0 bg-white/85 shadow-lg shadow-stone-900/5 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-2xl">Image Tools</CardTitle>
                <CardDescription>
                  Resize, compress, convert, preview, and export in the browser.
                </CardDescription>
                <CardAction className="flex gap-2">
                  <Badge variant="secondary">Client-side only</Badge>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  data-testid="dropzone"
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault()
                    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      return
                    }
                    setIsDragging(false)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    setIsDragging(false)
                    void handleIncomingFiles(event.dataTransfer.files)
                  }}
                  className={[
                    "rounded-2xl border border-dashed p-5 transition-colors",
                    isDragging
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 bg-stone-50/80 text-stone-700",
                  ].join(" ")}
                >
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex size-11 items-center justify-center rounded-full bg-white/90 text-stone-900 shadow-sm">
                      <ImagePlusIcon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">Drop images here</p>
                      <p className="text-sm text-current/70">
                        PNG, JPG, WebP, and AVIF only. Files stay in this tab.
                      </p>
                    </div>
                    <Button onClick={openFilePicker}>Choose files</Button>
                    <input
                      ref={inputRef}
                      className="hidden"
                      data-testid="file-input"
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES.join(",")}
                      multiple
                      onChange={(event) => {
                        if (event.target.files) {
                          void handleIncomingFiles(event.target.files)
                        }
                        event.target.value = ""
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="format">Output format</Label>
                    <Select
                      value={settings.format}
                      onValueChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          format: value as OutputFormat,
                        }))
                      }
                    >
                      <SelectTrigger id="format" className="w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAT_OPTIONS.map((option) => (
                          <SelectItem
                            key={option.value}
                            value={option.value}
                            disabled={!formatSupport[option.value]}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="quality">Compression quality</Label>
                      <Badge variant="outline">
                        {qualityDisabled ? "Lossless" : `${settings.quality}%`}
                      </Badge>
                    </div>
                    <Slider
                      aria-label="Compression quality"
                      data-testid="quality-slider"
                      id="quality"
                      disabled={qualityDisabled}
                      min={20}
                      max={100}
                      step={1}
                      value={[settings.quality]}
                      onValueChange={(value) =>
                        setSettings((current) => ({
                          ...current,
                          quality: Array.isArray(value) ? (value[0] ?? current.quality) : value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="rounded-2xl border bg-stone-50/70 p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Checkbox
                      id="resize-toggle"
                      checked={settings.resizeEnabled}
                      onCheckedChange={(checked) =>
                        setSettings((current) => ({
                          ...current,
                          resizeEnabled: Boolean(checked),
                        }))
                      }
                    />
                    <Label htmlFor="resize-toggle" className="font-medium">
                      Resize output
                    </Label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="width">Max width</Label>
                      <Input
                        id="width"
                        inputMode="numeric"
                        placeholder="1600"
                        value={settings.width}
                        disabled={!settings.resizeEnabled}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            width: event.target.value.replace(/[^\d]/g, ""),
                          }))
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="height">Max height</Label>
                      <Input
                        id="height"
                        inputMode="numeric"
                        placeholder="1600"
                        value={settings.height}
                        disabled={!settings.resizeEnabled}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            height: event.target.value.replace(/[^\d]/g, ""),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <label
                      htmlFor="keep-aspect-ratio"
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Checkbox
                        id="keep-aspect-ratio"
                        checked={settings.keepAspectRatio}
                        disabled={!settings.resizeEnabled}
                        onCheckedChange={(checked) =>
                          setSettings((current) => ({
                            ...current,
                            keepAspectRatio: Boolean(checked),
                          }))
                        }
                      />
                      Keep aspect ratio
                    </label>
                    <label
                      htmlFor="prevent-upscale"
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Checkbox
                        id="prevent-upscale"
                        checked={settings.preventUpscale}
                        disabled={!settings.resizeEnabled || !settings.keepAspectRatio}
                        onCheckedChange={(checked) =>
                          setSettings((current) => ({
                            ...current,
                            preventUpscale: Boolean(checked),
                          }))
                        }
                      />
                      Prevent upscale
                    </label>
                  </div>
                </div>

                {(errorMessage || queueHasErrors) && (
                  <Alert variant="destructive" data-testid="error-alert">
                    <AlertCircleIcon />
                    <AlertTitle>Validation</AlertTitle>
                    <AlertDescription>
                      {errorMessage ?? "One or more files could not be processed."}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 bg-transparent">
                <Button
                  data-testid="process-button"
                  disabled={isProcessing || items.length === 0}
                  onClick={() => void handleProcessBatch()}
                >
                  {isProcessing ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : (
                    <WandSparklesIcon />
                  )}
                  Process batch
                </Button>
                <Button
                  variant="outline"
                  disabled={processedCount === 0 || isProcessing || isExporting}
                  onClick={() => void handleDownloadAll()}
                >
                  {isExporting ? (
                    <LoaderCircleIcon className="animate-spin" />
                  ) : processedCount > 1 ? (
                    <FileArchiveIcon />
                  ) : (
                    <DownloadIcon />
                  )}
                  {processedCount > 1 ? "Download ZIP" : "Download file"}
                </Button>
                <Button
                  variant="ghost"
                  disabled={items.length === 0 || isProcessing}
                  onClick={handleClearAll}
                >
                  <Trash2Icon />
                  Clear
                </Button>
              </CardFooter>
            </Card>

            <Card size="sm" className="border-0 bg-white/80 shadow-sm shadow-stone-900/5">
              <CardHeader>
                <CardTitle>Batch summary</CardTitle>
                <CardDescription>
                  {items.length === 0
                    ? "No files queued."
                    : `${items.length} files queued, ${processedCount} processed.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <StatCard label="Original" value={formatBytes(totalOriginalBytes)} />
                  <StatCard
                    label="Processed"
                    value={processedCount === 0 ? "—" : formatBytes(totalProcessedBytes)}
                  />
                  <StatCard
                    label="Saved"
                    value={
                      processedCount === 0
                        ? "—"
                        : formatBytes(Math.max(0, totalOriginalBytes - totalProcessedBytes))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Queue progress</div>
                    <div className="text-sm text-muted-foreground">{progressValue}%</div>
                  </div>
                  <Progress value={progressValue} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card className="border-0 bg-white/85 shadow-lg shadow-stone-900/5 backdrop-blur">
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  Compare the current file before and after processing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedItem ? (
                  <>
                    <Tabs
                      key={`${selectedItem.id}-${selectedItem.processed ? "done" : "ready"}`}
                      defaultValue={selectedItem.processed ? "compare" : "original"}
                    >
                      <TabsList className="w-full justify-start">
                        <TabsTrigger value="compare" disabled={!selectedItem.processed}>
                          Compare
                        </TabsTrigger>
                        <TabsTrigger value="original">Original</TabsTrigger>
                        <TabsTrigger value="processed" disabled={!selectedItem.processed}>
                          Processed
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="compare" className="space-y-4 pt-4">
                        <div className="overflow-hidden rounded-[1.5rem] border bg-stone-950">
                          <div className="relative aspect-[4/3] w-full">
                            <img
                              src={selectedItem.sourceUrl}
                              alt={`Original ${selectedItem.file.name}`}
                              className="absolute inset-0 h-full w-full object-contain"
                            />
                            {selectedItem.processed && (
                              <>
                                <div
                                  className="absolute inset-0 overflow-hidden"
                                  style={{ width: `${compareValue[0] ?? 50}%` }}
                                >
                                  <img
                                    src={selectedItem.processed.url}
                                    alt={`Processed ${selectedItem.file.name}`}
                                    className="h-full w-full object-contain"
                                  />
                                </div>
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-white/90"
                                  style={{ left: `calc(${compareValue[0] ?? 50}% - 1px)` }}
                                />
                              </>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Before</span>
                            <span>After</span>
                          </div>
                          <Slider
                            aria-label="Before after slider"
                            min={0}
                            max={100}
                            step={1}
                            value={compareValue}
                            onValueChange={(value) =>
                              setCompareValue(Array.isArray(value) ? [...value] : [value])
                            }
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="original" className="pt-4">
                        <PreviewImage
                          src={selectedItem.sourceUrl}
                          alt={`Original ${selectedItem.file.name}`}
                        />
                      </TabsContent>

                      <TabsContent value="processed" className="pt-4">
                        {selectedItem.processed ? (
                          <PreviewImage
                            src={selectedItem.processed.url}
                            alt={`Processed ${selectedItem.file.name}`}
                          />
                        ) : (
                          <EmptyState
                            title="No processed preview yet"
                            description="Run the batch to generate a processed result."
                          />
                        )}
                      </TabsContent>
                    </Tabs>

                    <div className="grid gap-3 md:grid-cols-2">
                      <MetricPanel
                        label="Original"
                        primary={formatDimensions(selectedItem.width, selectedItem.height)}
                        secondary={formatBytes(selectedItem.file.size)}
                      />
                      <MetricPanel
                        label="Processed"
                        primary={
                          selectedItem.processed
                            ? formatDimensions(
                                selectedItem.processed.width,
                                selectedItem.processed.height,
                              )
                            : "Not processed"
                        }
                        secondary={
                          selectedItem.processed
                            ? getSizeDeltaLabel(
                                selectedItem.file.size,
                                selectedItem.processed.blob.size,
                              )
                            : "Waiting for output"
                        }
                      />
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="No file selected"
                    description="Add one or more images to start building a batch."
                  />
                )}
              </CardContent>
            </Card>

            <Card className="border-0 bg-white/85 shadow-lg shadow-stone-900/5 backdrop-blur">
              <CardHeader>
                <CardTitle>Queue</CardTitle>
                <CardDescription>
                  Tap any file to inspect it, then download it individually or export the full batch.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {items.length === 0 ? (
                  <div className="px-4 pb-4">
                    <EmptyState
                      title="Queue is empty"
                      description="Drag files into the drop zone or choose them from your device."
                    />
                  </div>
                ) : (
                  <ScrollArea className="h-[28rem] px-4 pb-4">
                    <div className="space-y-3">
                      {items.map((item) => {
                        const isSelected = item.id === selectedItem?.id
                        return (
                          <div
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedId(item.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                                setSelectedId(item.id)
                              }
                            }}
                            className={[
                              "w-full rounded-2xl border p-3 text-left transition-colors",
                              isSelected
                                ? "border-stone-900 bg-stone-900 text-white"
                                : "border-stone-200 bg-white hover:bg-stone-50",
                            ].join(" ")}
                          >
                            <div className="flex items-start gap-3">
                              <img
                                src={item.processed?.url ?? item.sourceUrl}
                                alt=""
                                className="size-16 rounded-xl border object-cover"
                              />
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{item.file.name}</p>
                                    <p
                                      className={[
                                        "text-sm",
                                        isSelected ? "text-white/70" : "text-muted-foreground",
                                      ].join(" ")}
                                    >
                                      {formatDimensions(item.width, item.height)} ·{" "}
                                      {formatBytes(item.file.size)}
                                    </p>
                                  </div>
                                  <StatusBadge status={item.status} />
                                </div>

                                {item.processed && (
                                  <div
                                    className={[
                                      "rounded-xl px-3 py-2 text-sm",
                                      isSelected ? "bg-white/10" : "bg-stone-50",
                                    ].join(" ")}
                                  >
                                    {formatDimensions(item.processed.width, item.processed.height)} ·{" "}
                                    {formatBytes(item.processed.blob.size)}
                                  </div>
                                )}

                                {item.error && (
                                  <p className="text-sm text-red-300 md:text-red-600">
                                    {item.error}
                                  </p>
                                )}

                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant={isSelected ? "secondary" : "outline"}
                                    disabled={!item.processed || isProcessing}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      if (item.processed) {
                                        downloadBlob(item.processed.blob, item.processed.fileName)
                                      }
                                    }}
                                  >
                                    <DownloadIcon />
                                    Download
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={isProcessing}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      handleRemove(item.id)
                                    }}
                                  >
                                    <Trash2Icon />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  )
}

function getValidatedSettings(
  settings: AppSettings,
  formatSupport: Record<OutputFormat, boolean>,
): ProcessSettings | { error: string } {
  if (!formatSupport[settings.format]) {
    return { error: `${settings.format.toUpperCase()} export is not available in this browser.` }
  }

  const width = parseDimension(settings.width)
  const height = parseDimension(settings.height)

  if (settings.resizeEnabled && !width && !height) {
    return { error: "Enter a width, a height, or both when resize is enabled." }
  }

  return {
    format: settings.format,
    quality: settings.quality / 100,
    resize: {
      enabled: settings.resizeEnabled,
      width,
      height,
      keepAspectRatio: settings.keepAspectRatio,
      preventUpscale: settings.preventUpscale,
    },
  }
}

function parseDimension(value: string) {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    return undefined
  }

  return Math.min(parsed, 8192)
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function PreviewImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border bg-stone-950">
      <div className="aspect-[4/3] w-full">
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      </div>
    </div>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-56 place-items-center rounded-[1.5rem] border border-dashed bg-stone-50/70 p-6 text-center">
      <div className="max-w-sm space-y-2">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function MetricPanel({
  label,
  primary,
  secondary,
}: {
  label: string
  primary: string
  secondary: string
}) {
  return (
    <div className="rounded-2xl border bg-stone-50/70 p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">{label}</p>
        <RefreshCwIcon className="size-4 text-muted-foreground" />
      </div>
      <Separator className="my-3" />
      <p className="text-lg font-medium">{primary}</p>
      <p className="text-sm text-muted-foreground">{secondary}</p>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-stone-50/70 px-3 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-medium">{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: ImageItem["status"] }) {
  if (status === "processing") {
    return (
      <Badge variant="secondary" className="gap-1">
        <LoaderCircleIcon className="size-3 animate-spin" />
        Processing
      </Badge>
    )
  }

  if (status === "done") {
    return <Badge variant="secondary">Ready</Badge>
  }

  if (status === "error") {
    return <Badge variant="destructive">Error</Badge>
  }

  return <Badge variant="outline">Queued</Badge>
}

export default App
