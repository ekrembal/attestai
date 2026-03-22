import { useMemo, useState } from "react"
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  ArrowLeft,
  ArrowRight,
  Download,
  LoaderCircle,
  MousePointer2,
  RotateCcw,
  RotateCw,
  ScanText,
  Trash2,
} from "lucide-react"
import { Link, Navigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { FileDropzone } from "@/components/file-dropzone"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { toolById, tools, type ToolId } from "@/data/tools"
import { downloadBlob } from "@/lib/download"
import {
  buildPagesFromSources,
  exportPdf,
  exportSplitZip,
  extractPdfText,
  loadPdfSource,
  parsePageSelection,
  parseSplitGroups,
  renderPageThumbnail,
  type PageItem,
  type PdfSource,
} from "@/lib/pdf"
import { cn } from "@/lib/utils"

type ThumbnailMap = Record<string, string>

function SortablePageCard({
  index,
  page,
  thumbnail,
  isSelected,
  onSelect,
}: {
  index: number
  page: PageItem
  thumbnail?: string
  isSelected: boolean
  onSelect: (pageId: string, selected: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "z-10 opacity-80")}
    >
      <Card
        data-testid={`page-card-${index + 1}`}
        className={cn(
          "h-full border-border/70 bg-background/90 transition-shadow",
          isSelected && "ring-2 ring-primary/40"
        )}
      >
        <CardContent className="space-y-3 p-3">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(page.id, Boolean(checked))}
                aria-label={`Select page ${index + 1}`}
              />
              Page {index + 1}
            </label>
            <button
              type="button"
              aria-label={`Drag page ${index + 1}`}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              {...attributes}
              {...listeners}
            >
              <MousePointer2 className="size-4" />
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border bg-zinc-100">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={`Preview of page ${page.pageNumber}`}
                className="aspect-[1/1.35] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[1/1.35] items-center justify-center text-sm text-muted-foreground">
                Rendering preview…
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {page.sourceName} · source p.{page.pageNumber}
            </span>
            <Badge variant="outline">Rotation {page.rotation}°</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function ToolPage() {
  const { toolId } = useParams<{ toolId: ToolId }>()
  const tool = toolId ? toolById.get(toolId) : undefined

  const [sources, setSources] = useState<PdfSource[]>([])
  const [pages, setPages] = useState<PageItem[]>([])
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([])
  const [thumbnails, setThumbnails] = useState<ThumbnailMap>({})
  const [rangeInput, setRangeInput] = useState("")
  const [textOutput, setTextOutput] = useState("")
  const [isBusy, setIsBusy] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const selectedPages = pages.filter((page) => selectedPageIds.includes(page.id))
  const selectedSourceIndexes = useMemo(
    () => selectedPages.map((page) => page.sourcePageIndex),
    [selectedPages]
  )

  if (!tool) {
    return <Navigate to="/" replace />
  }

  const activeTool = tool

  async function loadFiles(files: File[]) {
    const validFiles = files.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    )

    if (!validFiles.length) {
      toast.error("Choose one or more PDF files.")
      return
    }

    try {
      setIsBusy(true)
      const nextSources = await Promise.all(validFiles.map(loadPdfSource))
      const mergedSources = activeTool.acceptsMultipleFiles
        ? [...sources, ...nextSources]
        : nextSources
      const nextPages = activeTool.acceptsMultipleFiles
        ? [...pages, ...buildPagesFromSources(nextSources)]
        : buildPagesFromSources(nextSources)

      if (!activeTool.acceptsMultipleFiles) {
        setThumbnails({})
      }
      setSources(mergedSources)
      setPages(nextPages)
      setSelectedPageIds([])
      setTextOutput("")

      for (const source of nextSources) {
        for (let pageIndex = 0; pageIndex < source.pageCount; pageIndex += 1) {
          const thumbnail = await renderPageThumbnail(source, pageIndex)
          setThumbnails((current) => ({
            ...current,
            [`${source.id}-${pageIndex}`]: thumbnail,
          }))
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read PDF files.")
    } finally {
      setIsBusy(false)
    }
  }

  function updateSelection(pageId: string, selected: boolean) {
    setSelectedPageIds((current) =>
      selected ? [...new Set([...current, pageId])] : current.filter((item) => item !== pageId)
    )
  }

  function rotateSelection(amount: number) {
    if (!selectedPageIds.length) {
      toast.info("Select one or more pages first.")
      return
    }

    setPages((current) =>
      current.map((page) =>
        selectedPageIds.includes(page.id)
          ? { ...page, rotation: (page.rotation + amount + 360) % 360 }
          : page
      )
    )
  }

  function deleteSelection() {
    if (!selectedPageIds.length) {
      toast.info("Select pages to remove.")
      return
    }

    setPages((current) => current.filter((page) => !selectedPageIds.includes(page.id)))
    setSelectedPageIds([])
  }

  function keepSelectionOnly() {
    if (!selectedPageIds.length) {
      toast.info("Select pages to extract.")
      return
    }

    setPages((current) => current.filter((page) => selectedPageIds.includes(page.id)))
  }

  async function downloadCurrentPdf(filename: string, outputPages: PageItem[]) {
    if (!outputPages.length) {
      toast.error("There are no pages to export.")
      return
    }

    try {
      setIsBusy(true)
      const bytes = await exportPdf(sources, outputPages)
      const arrayBuffer =
        bytes.buffer instanceof ArrayBuffer
          ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
          : new Uint8Array(bytes).buffer

      downloadBlob(new Blob([arrayBuffer], { type: "application/pdf" }), filename)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.")
    } finally {
      setIsBusy(false)
    }
  }

  async function handlePrimaryAction() {
    if (!pages.length) {
      toast.info("Add a PDF first.")
      return
    }

    if (activeTool.id === "split") {
      try {
        setIsBusy(true)
        const groups =
          rangeInput.trim() === ""
            ? pages.map((_, index) => [index])
            : parseSplitGroups(rangeInput, pages.length)
        const blob = await exportSplitZip(sources, pages, groups)
        downloadBlob(blob, "split-pdfs.zip")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Split failed.")
      } finally {
        setIsBusy(false)
      }

      return
    }

    if (activeTool.id === "extract-pages") {
      await downloadCurrentPdf("extracted-pages.pdf", selectedPages)
      return
    }

    if (activeTool.id === "extract-text") {
      try {
        setIsBusy(true)
        const firstSource = sources[0]

        if (!firstSource) {
          toast.info("Add a PDF first.")
          return
        }

        const text = await extractPdfText(firstSource, selectedSourceIndexes)
        setTextOutput(text.combined)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Text extraction failed.")
      } finally {
        setIsBusy(false)
      }

      return
    }

    const filenames: Record<Exclude<ToolId, "split" | "extract-text">, string> = {
      merge: "merged.pdf",
      reorder: "reordered.pdf",
      rotate: "rotated.pdf",
      delete: "trimmed.pdf",
      "extract-pages": "extracted-pages.pdf",
    }

    await downloadCurrentPdf(filenames[activeTool.id], pages)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    setPages((current) => {
      const oldIndex = current.findIndex((page) => page.id === active.id)
      const newIndex = current.findIndex((page) => page.id === over.id)

      if (oldIndex < 0 || newIndex < 0) {
        return current
      }

      return arrayMove(current, oldIndex, newIndex)
    })
  }

  function handleRangeSelect() {
    try {
      const indexes = parsePageSelection(rangeInput, pages.length)
      const ids = indexes.map((index) => pages[index]?.id).filter(Boolean) as string[]
      setSelectedPageIds(ids)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid page range.")
    }
  }

  const actionLabel: Record<ToolId, string> = {
    merge: "Download merged PDF",
    split: "Download zip of split PDFs",
    reorder: "Download reordered PDF",
    rotate: "Download rotated PDF",
    delete: "Download trimmed PDF",
    "extract-pages": "Download extracted pages",
    "extract-text": "Extract text",
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_rgba(247,246,243,1),_rgba(255,255,255,1))]">
      <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8 lg:px-12">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Link to="/" className={cn(buttonVariants({ variant: "ghost" }))}>
              <ArrowLeft />
              Home
            </Link>
            <div className="space-y-2">
              <Badge variant="outline">Client-side PDF workflow</Badge>
              <h1 className="text-4xl font-semibold tracking-tight">{tool.title}</h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                {tool.description}
              </p>
            </div>
          </div>
          <Card size="sm" className="w-full max-w-md bg-zinc-950 text-zinc-50">
            <CardContent className="grid grid-cols-3 gap-4 p-4 text-center">
              <div>
                <p className="text-2xl font-semibold">{sources.length}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Files</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{pages.length}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Pages</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{selectedPageIds.length}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Selected</p>
              </div>
            </CardContent>
          </Card>
        </header>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <FileDropzone
              multiple={activeTool.acceptsMultipleFiles}
              disabled={isBusy}
              title="Add PDFs"
              description={
                activeTool.acceptsMultipleFiles
                  ? "Upload multiple PDFs to combine them in one workspace."
                  : "Upload a PDF to start editing its pages."
              }
              onFiles={loadFiles}
            />

            <Card>
              <CardHeader>
                <CardTitle>Selection tools</CardTitle>
                <CardDescription>
                  Select pages manually or use page ranges such as 1-3, 5, 8-9.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={rangeInput}
                    onChange={(event) => setRangeInput(event.target.value)}
                    placeholder="1-3, 6, 8-9"
                    data-testid="range-input"
                  />
                  <Button type="button" variant="outline" onClick={handleRangeSelect}>
                    Select
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => rotateSelection(-90)}>
                    <RotateCcw />
                    Rotate left
                  </Button>
                  <Button type="button" variant="outline" onClick={() => rotateSelection(90)}>
                    <RotateCw />
                    Rotate right
                  </Button>
                  <Button type="button" variant="outline" onClick={keepSelectionOnly}>
                    Keep selected
                  </Button>
                  <Button type="button" variant="outline" onClick={deleteSelection}>
                    <Trash2 />
                    Delete selected
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Export</CardTitle>
                <CardDescription>
                  {activeTool.id === "split"
                    ? "Leave the field blank to export one PDF per page, or enter one group per line."
                    : "Export the current workspace exactly as shown."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeTool.id === "split" ? (
                  <Textarea
                    value={rangeInput}
                    onChange={(event) => setRangeInput(event.target.value)}
                    className="min-h-32"
                    placeholder={"1-2\n3-4\n5-8"}
                    data-testid="split-groups"
                  />
                ) : null}

                {activeTool.id === "extract-text" && textOutput ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      downloadBlob(new Blob([textOutput], { type: "text/plain;charset=utf-8" }), "extracted-text.txt")
                    }
                  >
                    <Download />
                    Download text
                  </Button>
                ) : null}

                <Button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={isBusy || !pages.length}
                  data-testid="primary-action"
                >
                  {isBusy ? <LoaderCircle className="animate-spin" /> : <Download />}
                  {actionLabel[activeTool.id]}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Other tools</CardTitle>
                <CardDescription>Jump into a different PDF workflow.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {tools
                  .filter((item) => item.id !== activeTool.id)
                  .map((item) => (
                    <Link
                      key={item.id}
                      to={`/tools/${item.id}`}
                      className={cn(buttonVariants({ variant: "outline" }))}
                    >
                      {item.title}
                      <ArrowRight />
                    </Link>
                  ))}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Tabs defaultValue="pages">
              <TabsList>
                <TabsTrigger value="pages">Pages</TabsTrigger>
                <TabsTrigger value="output">Output</TabsTrigger>
              </TabsList>
              <TabsContent value="pages">
                <Card>
                  <CardHeader>
                    <CardTitle>Page workspace</CardTitle>
                    <CardDescription>
                      Drag cards to reorder. Use the range tools and page checkboxes to make selections.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pages.length ? (
                      <ScrollArea className="h-[70vh] rounded-xl border border-border/70 bg-background/70 p-4">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext items={pages.map((page) => page.id)} strategy={rectSortingStrategy}>
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                              {pages.map((page, index) => (
                                <SortablePageCard
                                  key={page.id}
                                  index={index}
                                  page={page}
                                  thumbnail={thumbnails[page.id]}
                                  isSelected={selectedPageIds.includes(page.id)}
                                  onSelect={updateSelection}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </ScrollArea>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 bg-muted/40 p-10 text-center text-sm text-muted-foreground">
                        Add a PDF to populate the page workspace.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="output">
                <Card>
                  <CardHeader>
                    <CardTitle>Output preview</CardTitle>
                    <CardDescription>
                      {activeTool.id === "extract-text"
                        ? "Extracted text appears here."
                        : "This summary reflects the current workspace state."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {activeTool.id === "extract-text" ? (
                      <Textarea
                        data-testid="text-output"
                        value={textOutput}
                        readOnly
                        className="min-h-[55vh] font-mono text-xs leading-6"
                        placeholder="Run text extraction to populate this panel."
                      />
                    ) : (
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-3">
                          <Card size="sm" className="bg-muted/40">
                            <CardContent className="p-4">
                              <p className="text-sm text-muted-foreground">Current pages</p>
                              <p className="mt-2 text-3xl font-semibold">{pages.length}</p>
                            </CardContent>
                          </Card>
                          <Card size="sm" className="bg-muted/40">
                            <CardContent className="p-4">
                              <p className="text-sm text-muted-foreground">Selected pages</p>
                              <p className="mt-2 text-3xl font-semibold">{selectedPageIds.length}</p>
                            </CardContent>
                          </Card>
                          <Card size="sm" className="bg-muted/40">
                            <CardContent className="p-4">
                              <p className="text-sm text-muted-foreground">Source files</p>
                              <p className="mt-2 text-3xl font-semibold">{sources.length}</p>
                            </CardContent>
                          </Card>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Output order
                          </h3>
                          <div className="flex flex-wrap gap-2" data-testid="output-order">
                            {pages.map((page, index) => (
                              <Badge key={page.id} variant="outline">
                                {index + 1}: {page.sourceName} p.{page.pageNumber}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <Card className="bg-zinc-950 text-zinc-50">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-50">Privacy note</p>
                  <p className="text-sm text-zinc-300">
                    Every operation runs locally in the browser. No files are uploaded or stored remotely.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-emerald-300">
                  <ScanText className="size-4" />
                  Browser processing only
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}
