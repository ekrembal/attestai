import * as React from "react"
import {
  Download,
  FilePenLine,
  FileText,
  Grip,
  ImagePlus,
  LoaderCircle,
  PenLine,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react"

import { SignaturePad } from "@/components/signature-pad"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  createSamplePdf,
  downloadBlob,
  exportAnnotatedPdf,
  loadPdfDocument,
  validateAnnotations,
  type EditorAnnotation,
  type LoadedDocument,
} from "@/lib/document"

type SavedSignature = {
  id: string
  label: string
  dataUrl: string
}

type DragMode = "move" | "resize"

type DragState = {
  id: string
  mode: DragMode
  startX: number
  startY: number
  rect: DOMRect
  initialX: number
  initialY: number
  initialWidth: number
  initialHeight: number
}

const PDF_MAX_BYTES = 20 * 1024 * 1024
const SAVED_SIGNATURES_KEY = "document-form-helper.saved-signatures"

function createAnnotationId() {
  return crypto.randomUUID()
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function baseName(filename: string) {
  const lastDot = filename.lastIndexOf(".")

  return lastDot === -1 ? filename : filename.slice(0, lastDot)
}

function createTextAnnotation(page: number): EditorAnnotation {
  return {
    id: createAnnotationId(),
    page,
    type: "text",
    x: 0.12,
    y: 0.14,
    width: 0.36,
    height: 0.1,
    text: "Type here",
    fontSize: 18,
    color: "#152224",
    label: "Text field",
  }
}

function createImageAnnotation(
  page: number,
  type: "image" | "signature",
  dataUrl: string,
  label: string
): EditorAnnotation {
  return {
    id: createAnnotationId(),
    page,
    type,
    x: 0.14,
    y: type === "signature" ? 0.7 : 0.18,
    width: type === "signature" ? 0.28 : 0.22,
    height: type === "signature" ? 0.12 : 0.16,
    dataUrl,
    opacity: 1,
    label,
  }
}

function loadSavedSignatures() {
  try {
    const raw = localStorage.getItem(SAVED_SIGNATURES_KEY)
    if (!raw) {
      return [] as SavedSignature[]
    }

    const parsed = JSON.parse(raw) as SavedSignature[]
    return parsed.filter(
      (signature) =>
        typeof signature.id === "string" &&
        typeof signature.label === "string" &&
        typeof signature.dataUrl === "string"
    )
  } catch {
    return [] as SavedSignature[]
  }
}

function saveSavedSignatures(signatures: SavedSignature[]) {
  localStorage.setItem(SAVED_SIGNATURES_KEY, JSON.stringify(signatures))
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Could not read the selected file."))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

export function App() {
  const pdfInputRef = React.useRef<HTMLInputElement | null>(null)
  const imageInputRef = React.useRef<HTMLInputElement | null>(null)
  const pageSurfaceRef = React.useRef<HTMLDivElement | null>(null)
  const dragStateRef = React.useRef<DragState | null>(null)

  const [documentState, setDocumentState] = React.useState<LoadedDocument | null>(null)
  const [annotations, setAnnotations] = React.useState<EditorAnnotation[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [isLoadingDocument, setIsLoadingDocument] = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)
  const [isSignatureDialogOpen, setIsSignatureDialogOpen] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [statusMessage, setStatusMessage] = React.useState(
    "Load a PDF or use the sample document to start editing."
  )
  const [savedSignatures, setSavedSignatures] = React.useState<SavedSignature[]>([])

  const selectedAnnotation =
    annotations.find((annotation) => annotation.id === selectedId) ?? null
  const currentPagePreview =
    documentState?.pages.find((page) => page.pageNumber === currentPage) ?? null
  const currentPageAnnotations = annotations.filter(
    (annotation) => annotation.page === currentPage
  )

  React.useEffect(() => {
    setSavedSignatures(loadSavedSignatures())
  }, [])

  React.useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState) {
        return
      }

      setAnnotations((currentAnnotations) =>
        currentAnnotations.map((annotation) => {
          if (annotation.id !== dragState.id) {
            return annotation
          }

          const deltaX = (event.clientX - dragState.startX) / dragState.rect.width
          const deltaY = (event.clientY - dragState.startY) / dragState.rect.height

          if (dragState.mode === "move") {
            return {
              ...annotation,
              x: clamp(dragState.initialX + deltaX, 0, 1 - annotation.width),
              y: clamp(dragState.initialY + deltaY, 0, 1 - annotation.height),
            }
          }

          const nextWidth = clamp(dragState.initialWidth + deltaX, 0.08, 1 - annotation.x)
          const nextHeight = clamp(
            dragState.initialHeight + deltaY,
            annotation.type === "text" ? 0.06 : 0.08,
            1 - annotation.y
          )

          return {
            ...annotation,
            width: nextWidth,
            height: nextHeight,
          }
        })
      )
    }

    const handlePointerUp = () => {
      dragStateRef.current = null
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedId) {
        return
      }

      if (event.target instanceof HTMLElement) {
        const editable = event.target.closest("input, textarea, select, [contenteditable='true']")
        if (editable) {
          return
        }
      }

      if (event.key !== "Backspace" && event.key !== "Delete") {
        return
      }

      setAnnotations((currentAnnotations) =>
        currentAnnotations.filter((annotation) => annotation.id !== selectedId)
      )
      setSelectedId(null)
      setStatusMessage("Annotation removed.")
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [selectedId])

  const setStatus = (message: string) => {
    setStatusMessage(message)
    setErrorMessage(null)
  }

  const setError = (message: string) => {
    setErrorMessage(message)
  }

  const updateAnnotation = (
    id: string,
    updater: (annotation: EditorAnnotation) => EditorAnnotation
  ) => {
    setAnnotations((currentAnnotations) =>
      currentAnnotations.map((annotation) =>
        annotation.id === id ? updater(annotation) : annotation
      )
    )
  }

  const ensureDocument = (actionLabel: string) => {
    if (documentState) {
      return true
    }

    setError(`Load a PDF before trying to ${actionLabel}.`)
    return false
  }

  const resetEditorForDocument = (
    nextDocumentState: LoadedDocument,
    nextStatus: string
  ) => {
    setDocumentState(nextDocumentState)
    setAnnotations([])
    setSelectedId(null)
    setCurrentPage(1)
    setStatus(nextStatus)
  }

  const handlePdfBytes = async (bytes: Uint8Array, name: string) => {
    setIsLoadingDocument(true)

    try {
      const nextDocumentState = await loadPdfDocument(bytes, name)
      resetEditorForDocument(
        nextDocumentState,
        `${name} loaded with ${nextDocumentState.pages.length} page${nextDocumentState.pages.length === 1 ? "" : "s"}.`
      )
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The PDF could not be read in the browser."
      )
    } finally {
      setIsLoadingDocument(false)
    }
  }

  const handlePdfFile = async (file: File | null) => {
    if (!file) {
      return
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Only PDF documents are supported.")
      return
    }

    if (file.size > PDF_MAX_BYTES) {
      setError("PDFs larger than 20 MB are blocked to keep editing responsive.")
      return
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    await handlePdfBytes(bytes, file.name)
  }

  const handleCreateSample = async () => {
    const sampleBytes = await createSamplePdf()
    await handlePdfBytes(sampleBytes, "sample-travel-form.pdf")
  }

  const addTextField = () => {
    if (!ensureDocument("add a text field")) {
      return
    }

    const annotation = createTextAnnotation(currentPage)
    setAnnotations((currentAnnotations) => [...currentAnnotations, annotation])
    setSelectedId(annotation.id)
    setStatus("Text field added. Drag it into place and edit the value on the right.")
  }

  const placeSavedSignature = (signature: SavedSignature) => {
    if (!ensureDocument("place a saved signature")) {
      return
    }

    const annotation = createImageAnnotation(
      currentPage,
      "signature",
      signature.dataUrl,
      signature.label
    )

    setAnnotations((currentAnnotations) => [...currentAnnotations, annotation])
    setSelectedId(annotation.id)
    setStatus(`Placed saved signature "${signature.label}".`)
  }

  const handleSignatureCreated = (
    dataUrl: string,
    shouldSave: boolean,
    label: string
  ) => {
    if (!ensureDocument("place a signature")) {
      return
    }

    const trimmedLabel = label || `Signature ${savedSignatures.length + 1}`
    const annotation = createImageAnnotation(
      currentPage,
      "signature",
      dataUrl,
      trimmedLabel
    )

    if (shouldSave) {
      const nextSavedSignatures = [
        {
          id: createAnnotationId(),
          label: trimmedLabel,
          dataUrl,
        },
        ...savedSignatures,
      ].slice(0, 8)

      setSavedSignatures(nextSavedSignatures)
      saveSavedSignatures(nextSavedSignatures)
    }

    setAnnotations((currentAnnotations) => [...currentAnnotations, annotation])
    setSelectedId(annotation.id)
    setStatus(
      shouldSave
        ? `Signature saved locally and placed on page ${currentPage}.`
        : `Signature placed on page ${currentPage}.`
    )
  }

  const handleImageFile = async (file: File | null) => {
    if (!file) {
      return
    }

    if (!ensureDocument("add an image or stamp")) {
      return
    }

    if (!file.type.startsWith("image/")) {
      setError("Only image files can be placed as stamps or signature images.")
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      const annotation = createImageAnnotation(
        currentPage,
        "image",
        dataUrl,
        file.name || "Stamp"
      )

      setAnnotations((currentAnnotations) => [...currentAnnotations, annotation])
      setSelectedId(annotation.id)
      setStatus("Image placed. Drag to position and resize from the lower-right handle.")
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The image could not be read in the browser."
      )
    }
  }

  const handleExportPdf = async () => {
    if (!documentState) {
      setError("Load a PDF before exporting.")
      return
    }

    const validationError = validateAnnotations(annotations)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsExporting(true)

    try {
      const blob = await exportAnnotatedPdf(documentState.bytes, annotations)
      downloadBlob(blob, `${baseName(documentState.name)}-edited.pdf`)
      setStatus("Edited PDF downloaded.")
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The PDF could not be exported."
      )
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportProject = () => {
    if (!documentState) {
      setError("Load a PDF before exporting the annotation snapshot.")
      return
    }

    const projectBlob = new Blob(
      [
        JSON.stringify(
          {
            documentName: documentState.name,
            pageCount: documentState.pages.length,
            exportedAt: new Date().toISOString(),
            annotations,
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    )

    downloadBlob(projectBlob, `${baseName(documentState.name)}-annotations.json`)
    setStatus("Annotation snapshot exported as JSON.")
  }

  const handleStartDrag = (
    event: React.PointerEvent<HTMLElement>,
    annotation: EditorAnnotation,
    mode: DragMode
  ) => {
    event.preventDefault()
    event.stopPropagation()

    const rect = pageSurfaceRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    dragStateRef.current = {
      id: annotation.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      rect,
      initialX: annotation.x,
      initialY: annotation.y,
      initialWidth: annotation.width,
      initialHeight: annotation.height,
    }
    setSelectedId(annotation.id)
  }

  const removeAnnotation = (id: string) => {
    setAnnotations((currentAnnotations) =>
      currentAnnotations.filter((annotation) => annotation.id !== id)
    )
    setSelectedId((currentSelectedId) => (currentSelectedId === id ? null : currentSelectedId))
    setStatus("Annotation removed.")
  }

  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top,_rgba(190,220,214,0.4),_transparent_35%),linear-gradient(180deg,#fffdf8_0%,#f6f0e6_100%)] text-foreground">
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={async (event) => {
          await handlePdfFile(event.target.files?.[0] ?? null)
          event.target.value = ""
        }}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          await handleImageFile(event.target.files?.[0] ?? null)
          event.target.value = ""
        }}
      />

      <SignaturePad
        open={isSignatureDialogOpen}
        onOpenChange={setIsSignatureDialogOpen}
        defaultName={`Signature ${savedSignatures.length + 1}`}
        onPlaceSignature={handleSignatureCreated}
      />

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <header className="rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_30px_90px_-45px_rgba(21,34,36,0.5)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-[#d8ebe6] text-[#173137]">
                  Browser only
                </Badge>
                <Badge variant="secondary" className="bg-[#efe4d0] text-[#5d4631]">
                  Local files only
                </Badge>
                <Badge variant="secondary" className="bg-[#e5edf2] text-[#274555]">
                  No backend
                </Badge>
              </div>
              <div className="space-y-1">
                <h1 className="font-heading text-3xl font-semibold tracking-tight text-[#142123] sm:text-4xl">
                  Document Form Helper
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Fill text fields, place signatures, add free text anywhere,
                  and stamp images directly on a PDF in the browser. Nothing
                  leaves the device.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="bg-white/70"
                onClick={() => pdfInputRef.current?.click()}
                data-testid="upload-pdf-button"
              >
                <Upload />
                Import PDF
              </Button>
              <Button
                variant="secondary"
                className="bg-[#d8ebe6] text-[#173137] hover:bg-[#c8e0da]"
                onClick={handleCreateSample}
                data-testid="sample-document-button"
              >
                <FileText />
                Use sample document
              </Button>
              <Button
                onClick={handleExportPdf}
                disabled={isExporting || isLoadingDocument}
                data-testid="download-pdf-button"
              >
                {isExporting ? <LoaderCircle className="animate-spin" /> : <Download />}
                Download PDF
              </Button>
            </div>
          </div>
        </header>

        {errorMessage ? (
          <Alert variant="destructive" data-testid="error-alert">
            <AlertTitle>Action blocked</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="border-white/70 bg-white/75 shadow-sm backdrop-blur">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={addTextField} variant="secondary" data-testid="add-text-button">
                <Plus />
                Add text field
              </Button>
              <Button
                onClick={() => {
                  if (!ensureDocument("draw a signature")) {
                    return
                  }

                  setIsSignatureDialogOpen(true)
                }}
                variant="outline"
                data-testid="draw-signature-button"
              >
                <PenLine />
                Draw signature
              </Button>
              <Button
                onClick={() => imageInputRef.current?.click()}
                variant="outline"
                data-testid="add-image-button"
              >
                <ImagePlus />
                Add image / stamp
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" data-testid="saved-signatures-button" />}
                >
                  <Save />
                  Saved signatures
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64">
                  <DropdownMenuLabel>Reuse from this browser</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {savedSignatures.length === 0 ? (
                    <DropdownMenuItem disabled>
                      No saved signatures yet
                    </DropdownMenuItem>
                  ) : (
                    savedSignatures.map((signature) => (
                      <DropdownMenuItem
                        key={signature.id}
                        onClick={() => placeSavedSignature(signature)}
                        data-testid={`saved-signature-${signature.id}`}
                      >
                        {signature.label}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={handleExportProject}
                variant="outline"
                disabled={!documentState}
                data-testid="export-project-button"
              >
                <FilePenLine />
                Export JSON
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{statusMessage}</span>
              {documentState ? (
                <>
                  <Separator orientation="vertical" className="hidden h-4 md:block" />
                  <span>{documentState.name}</span>
                  <Separator orientation="vertical" className="hidden h-4 md:block" />
                  <span>
                    {annotations.length} annotation{annotations.length === 1 ? "" : "s"}
                  </span>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
          <Card className="order-2 border-white/70 bg-white/75 shadow-sm backdrop-blur xl:order-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pages</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <ScrollArea className="h-[260px] xl:h-[calc(100svh-18rem)]">
                <div className="space-y-3 pr-2">
                  {documentState?.pages.map((page) => {
                    const pageAnnotationCount = annotations.filter(
                      (annotation) => annotation.page === page.pageNumber
                    ).length

                    return (
                      <button
                        key={page.pageNumber}
                        type="button"
                        onClick={() => {
                          setCurrentPage(page.pageNumber)
                          setStatus(`Viewing page ${page.pageNumber}.`)
                        }}
                        className={cn(
                          "w-full rounded-2xl border p-2 text-left transition hover:border-[#8bb3aa] hover:bg-[#f5faf8]",
                          currentPage === page.pageNumber
                            ? "border-[#5d9487] bg-[#edf7f4]"
                            : "border-border bg-background"
                        )}
                      >
                        <div className="overflow-hidden rounded-xl border bg-white">
                          <img src={page.previewUrl} alt={`Page ${page.pageNumber}`} />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span>Page {page.pageNumber}</span>
                          <Badge variant="outline">
                            {pageAnnotationCount} item{pageAnnotationCount === 1 ? "" : "s"}
                          </Badge>
                        </div>
                      </button>
                    )
                  }) ?? (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                      No document loaded yet.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="order-1 border-white/70 bg-white/75 shadow-sm backdrop-blur xl:order-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Editor</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 sm:px-4">
              {isLoadingDocument ? (
                <div className="flex min-h-[60svh] flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed border-border bg-[#faf7ef]">
                  <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Rendering page previews in the browser…
                  </p>
                </div>
              ) : currentPagePreview ? (
                <div
                  ref={pageSurfaceRef}
                  className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-[28px] border border-[#d4d7d0] bg-white shadow-[0_24px_70px_-40px_rgba(17,24,39,0.6)]"
                  onClick={() => setSelectedId(null)}
                  style={{ aspectRatio: `${currentPagePreview.width} / ${currentPagePreview.height}` }}
                >
                  <img
                    src={currentPagePreview.previewUrl}
                    alt={`Document page ${currentPage}`}
                    className="h-full w-full object-cover"
                    data-testid="page-preview"
                  />

                  {currentPageAnnotations.map((annotation) => {
                    const isSelected = annotation.id === selectedId

                    return (
                      <button
                        key={annotation.id}
                        type="button"
                        className={cn(
                          "absolute block rounded-xl border text-left transition focus:outline-none",
                          annotation.type === "text"
                            ? "bg-white/90 shadow-sm"
                            : "bg-transparent",
                          isSelected
                            ? "border-[#2b8472] ring-2 ring-[#2b8472]/30"
                            : "border-transparent hover:border-[#2b8472]/45"
                        )}
                        style={{
                          left: `${annotation.x * 100}%`,
                          top: `${annotation.y * 100}%`,
                          width: `${annotation.width * 100}%`,
                          height: `${annotation.height * 100}%`,
                        }}
                        onClick={(event) => {
                          event.stopPropagation()
                          setSelectedId(annotation.id)
                        }}
                        data-testid={`annotation-${annotation.id}`}
                      >
                        <span
                          className="pointer-events-none absolute top-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white"
                        >
                          {annotation.type}
                        </span>
                        <span
                          className="absolute top-1 right-1 flex rounded-full bg-white/90 px-1.5 py-1 text-[#173137] shadow-sm"
                          onPointerDown={(event) => handleStartDrag(event, annotation, "move")}
                          role="presentation"
                          data-testid={`move-${annotation.id}`}
                        >
                          <Grip className="size-3.5" />
                        </span>

                        {annotation.type === "text" ? (
                          <div className="flex h-full w-full items-start rounded-xl px-3 py-7">
                            <div
                              className={cn(
                                "line-clamp-[8] whitespace-pre-wrap text-left leading-tight",
                                !(annotation.text ?? "").trim() && "text-destructive"
                              )}
                              style={{
                                color: annotation.color,
                                fontSize: `${annotation.fontSize ?? 18}px`,
                              }}
                            >
                              {annotation.text || "Empty field"}
                            </div>
                          </div>
                        ) : (
                          <img
                            src={annotation.dataUrl}
                            alt={annotation.label}
                            className="h-full w-full rounded-xl object-contain"
                            style={{ opacity: annotation.opacity ?? 1 }}
                          />
                        )}

                        <span
                          className="absolute right-1 bottom-1 size-4 rounded-md border border-[#2b8472] bg-white shadow-sm"
                          onPointerDown={(event) => handleStartDrag(event, annotation, "resize")}
                          role="presentation"
                          data-testid={`resize-${annotation.id}`}
                        />
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex min-h-[60svh] flex-col items-center justify-center rounded-[28px] border border-dashed border-border bg-[#faf7ef] p-6 text-center">
                  <div className="rounded-full bg-[#d8ebe6] p-3 text-[#173137]">
                    <FileText className="size-8" />
                  </div>
                  <h2 className="mt-4 text-lg font-medium">No document loaded</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Import a local PDF or open the sample form to start placing
                    text, signatures, and stamps.
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button onClick={() => pdfInputRef.current?.click()}>
                      <Upload />
                      Import PDF
                    </Button>
                    <Button variant="outline" onClick={handleCreateSample}>
                      <FileText />
                      Use sample
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="order-3 border-white/70 bg-white/75 shadow-sm backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Inspector</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-4">
              <div className="space-y-2">
                <Label>Current page</Label>
                <Select
                  value={String(currentPage)}
                  onValueChange={(value) => setCurrentPage(Number(value))}
                  disabled={!documentState}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select page" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentState?.pages.map((page) => (
                      <SelectItem key={page.pageNumber} value={String(page.pageNumber)}>
                        Page {page.pageNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border bg-[#f5faf8] p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Document
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {documentState?.name ?? "None"}
                  </div>
                </div>
                <div className="rounded-2xl border bg-[#f9f5eb] p-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Selected
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {selectedAnnotation?.label ?? "No item"}
                  </div>
                </div>
              </div>

              <Separator />

              {selectedAnnotation ? (
                <div className="space-y-4" data-testid="annotation-inspector">
                  <div className="space-y-2">
                    <Label htmlFor="annotation-label">Label</Label>
                    <Input
                      id="annotation-label"
                      value={selectedAnnotation.label}
                      onChange={(event) =>
                        updateAnnotation(selectedAnnotation.id, (annotation) => ({
                          ...annotation,
                          label: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Page</Label>
                    <Select
                      value={String(selectedAnnotation.page)}
                      onValueChange={(value) => {
                        updateAnnotation(selectedAnnotation.id, (annotation) => ({
                          ...annotation,
                          page: Number(value),
                        }))
                        setCurrentPage(Number(value))
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {documentState?.pages.map((page) => (
                          <SelectItem key={page.pageNumber} value={String(page.pageNumber)}>
                            Page {page.pageNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedAnnotation.type === "text" ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="annotation-text">Text value</Label>
                        <Textarea
                          id="annotation-text"
                          value={selectedAnnotation.text ?? ""}
                          onChange={(event) =>
                            updateAnnotation(selectedAnnotation.id, (annotation) => ({
                              ...annotation,
                              text: event.target.value,
                            }))
                          }
                          data-testid="annotation-textarea"
                        />
                        {!(selectedAnnotation.text ?? "").trim() ? (
                          <p className="text-sm text-destructive">
                            Empty text fields are blocked from export.
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Font size</Label>
                          <span className="text-sm text-muted-foreground">
                            {selectedAnnotation.fontSize ?? 18}px
                          </span>
                        </div>
                        <Slider
                          value={[selectedAnnotation.fontSize ?? 18]}
                          min={10}
                          max={32}
                          step={1}
                          onValueChange={(nextValue) =>
                            updateAnnotation(selectedAnnotation.id, (annotation) => ({
                              ...annotation,
                              fontSize: Array.isArray(nextValue) ? nextValue[0] : nextValue,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="annotation-color">Text color</Label>
                        <Input
                          id="annotation-color"
                          type="color"
                          className="h-11"
                          value={selectedAnnotation.color ?? "#152224"}
                          onChange={(event) =>
                            updateAnnotation(selectedAnnotation.id, (annotation) => ({
                              ...annotation,
                              color: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Opacity</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round((selectedAnnotation.opacity ?? 1) * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[selectedAnnotation.opacity ?? 1]}
                        min={0.2}
                        max={1}
                        step={0.05}
                        onValueChange={(nextValue) =>
                          updateAnnotation(selectedAnnotation.id, (annotation) => ({
                            ...annotation,
                            opacity: Array.isArray(nextValue) ? nextValue[0] : nextValue,
                          }))
                        }
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Width</Label>
                      <Slider
                        value={[selectedAnnotation.width]}
                        min={0.08}
                        max={0.9}
                        step={0.01}
                        onValueChange={(nextValue) =>
                          updateAnnotation(selectedAnnotation.id, (annotation) => ({
                            ...annotation,
                            width: Array.isArray(nextValue) ? nextValue[0] : nextValue,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Height</Label>
                      <Slider
                        value={[selectedAnnotation.height]}
                        min={selectedAnnotation.type === "text" ? 0.06 : 0.08}
                        max={0.6}
                        step={0.01}
                        onValueChange={(nextValue) =>
                          updateAnnotation(selectedAnnotation.id, (annotation) => ({
                            ...annotation,
                            height: Array.isArray(nextValue) ? nextValue[0] : nextValue,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => removeAnnotation(selectedAnnotation.id)}
                  >
                    <Trash2 />
                    Remove annotation
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-[#faf7ef] p-5 text-sm leading-6 text-muted-foreground">
                  Select an annotation on the page to edit its text, size,
                  opacity, or page placement. Drag the grip to move it and use
                  the lower-right handle to resize it.
                </div>
              )}

              {savedSignatures.length > 0 ? (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Saved signatures</Label>
                      <Badge variant="outline">{savedSignatures.length}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {savedSignatures.slice(0, 4).map((signature) => (
                        <button
                          key={signature.id}
                          type="button"
                          className="overflow-hidden rounded-2xl border bg-white p-2 text-left transition hover:border-[#8bb3aa]"
                          onClick={() => placeSavedSignature(signature)}
                          data-testid={`signature-tile-${signature.id}`}
                        >
                          <div className="aspect-[3/1] rounded-xl bg-[#fffdf7] p-2">
                            <img
                              src={signature.dataUrl}
                              alt={signature.label}
                              className="h-full w-full object-contain"
                            />
                          </div>
                          <div className="mt-2 truncate text-xs text-muted-foreground">
                            {signature.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default App
