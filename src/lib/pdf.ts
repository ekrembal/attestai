import JSZip from "jszip"
import { degrees, PDFDocument } from "pdf-lib"
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist"

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString()

export type PdfSource = {
  id: string
  name: string
  bytes: Uint8Array
  pageCount: number
}

export type PageItem = {
  id: string
  sourceId: string
  sourceName: string
  sourcePageIndex: number
  pageNumber: number
  rotation: number
}

export type TextExtractionResult = {
  combined: string
  byPage: { pageNumber: number; text: string }[]
}

function makeId(prefix: string) {
  if ("randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2)}`
}

export async function readFileBytes(file: File) {
  return new Uint8Array(await file.arrayBuffer())
}

export async function loadPdfSource(file: File): Promise<PdfSource> {
  const bytes = await readFileBytes(file)
  const document = await PDFDocument.load(bytes)

  return {
    id: makeId("pdf"),
    name: file.name.replace(/\.pdf$/i, "") || "document",
    bytes,
    pageCount: document.getPageCount(),
  }
}

export function buildPagesFromSources(sources: PdfSource[]) {
  return sources.flatMap((source) =>
    Array.from({ length: source.pageCount }, (_, index) => ({
      id: `${source.id}-${index}`,
      sourceId: source.id,
      sourceName: source.name,
      sourcePageIndex: index,
      pageNumber: index + 1,
      rotation: 0,
    }))
  )
}

export async function exportPdf(
  sources: PdfSource[],
  pages: PageItem[]
): Promise<Uint8Array> {
  const output = await PDFDocument.create()
  const sourceCache = new Map<string, PDFDocument>()

  for (const page of pages) {
    let source = sourceCache.get(page.sourceId)

    if (!source) {
      const sourceFile = sources.find((item) => item.id === page.sourceId)

      if (!sourceFile) {
        throw new Error(`Missing source document for page ${page.id}.`)
      }

      source = await PDFDocument.load(sourceFile.bytes)
      sourceCache.set(page.sourceId, source)
    }

    const [copiedPage] = await output.copyPages(source, [page.sourcePageIndex])
    const currentAngle = copiedPage.getRotation().angle
    copiedPage.setRotation(degrees((currentAngle + page.rotation + 360) % 360))
    output.addPage(copiedPage)
  }

  return output.save()
}

export async function exportSplitZip(
  sources: PdfSource[],
  pages: PageItem[],
  groups: number[][]
): Promise<Blob> {
  const zip = new JSZip()

  for (const [index, group] of groups.entries()) {
    const outputPages = group
      .map((pageIndex) => pages[pageIndex])
      .filter(Boolean)

    const bytes = await exportPdf(sources, outputPages)
    zip.file(`split-${index + 1}.pdf`, bytes)
  }

  return zip.generateAsync({ type: "blob" })
}

export function parsePageSelection(
  input: string,
  maxPages: number
): number[] {
  const indexes = new Set<number>()

  for (const part of input.split(",")) {
    const trimmed = part.trim()

    if (!trimmed) {
      continue
    }

    const [startRaw, endRaw] = trimmed.split("-").map((value) => value.trim())
    const start = Number(startRaw)
    const end = Number(endRaw ?? startRaw)

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start < 1 ||
      end < 1 ||
      start > maxPages ||
      end > maxPages
    ) {
      throw new Error(`Page range "${trimmed}" is out of bounds.`)
    }

    const step = start <= end ? 1 : -1

    for (let current = start; ; current += step) {
      indexes.add(current - 1)

      if (current === end) {
        break
      }
    }
  }

  return [...indexes].sort((left, right) => left - right)
}

export function parseSplitGroups(input: string, maxPages: number): number[][] {
  const groups = input
    .split(/\n|\|/)
    .map((group) => group.trim())
    .filter(Boolean)

  if (!groups.length) {
    throw new Error("Add at least one page group.")
  }

  return groups.map((group) => parsePageSelection(group, maxPages))
}

export async function renderPageThumbnail(
  source: PdfSource,
  pageIndex: number
): Promise<string> {
  const pdfDocument = await getDocument({ data: source.bytes.slice() }).promise
  const page = await pdfDocument.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale: 1 })
  const scale = 176 / viewport.width
  const renderViewport = page.getViewport({ scale })
  const canvas = globalThis.document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Could not create a canvas context.")
  }

  canvas.width = renderViewport.width
  canvas.height = renderViewport.height

  await page.render({
    canvas,
    canvasContext: context,
    viewport: renderViewport,
  }).promise
  await pdfDocument.destroy()

  return canvas.toDataURL("image/png")
}

export async function extractPdfText(
  source: PdfSource,
  pageIndexes?: number[]
): Promise<TextExtractionResult> {
  const document = await getDocument({ data: source.bytes.slice() }).promise
  const targets =
    pageIndexes && pageIndexes.length
      ? pageIndexes.map((index) => index + 1)
      : Array.from({ length: source.pageCount }, (_, index) => index + 1)

  const byPage: TextExtractionResult["byPage"] = []

  for (const pageNumber of targets) {
    const page = await document.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()

    byPage.push({ pageNumber, text })
  }

  await document.destroy()

  const combined = byPage
    .map((page) => `Page ${page.pageNumber}\n${page.text || "[No text found]"}`)
    .join("\n\n")

  return { combined, byPage }
}
