import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
} from "pdf-lib"
import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"

GlobalWorkerOptions.workerSrc = pdfWorker

export type AnnotationKind = "text" | "signature" | "image"

export type EditorAnnotation = {
  id: string
  page: number
  type: AnnotationKind
  x: number
  y: number
  width: number
  height: number
  text?: string
  fontSize?: number
  color?: string
  dataUrl?: string
  opacity?: number
  label: string
}

export type PagePreview = {
  pageNumber: number
  width: number
  height: number
  previewUrl: string
}

export type LoadedDocument = {
  bytes: Uint8Array
  name: string
  pages: PagePreview[]
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function hexToRgb(color: string) {
  const value = color.replace("#", "")
  const safe = value.length === 3
    ? value
        .split("")
        .map((part) => `${part}${part}`)
        .join("")
    : value.padEnd(6, "0").slice(0, 6)

  const red = Number.parseInt(safe.slice(0, 2), 16) / 255
  const green = Number.parseInt(safe.slice(2, 4), 16) / 255
  const blue = Number.parseInt(safe.slice(4, 6), 16) / 255

  return rgb(red, green, blue)
}

function dataUrlToUint8Array(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? ""
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

async function renderPagePreview(pdf: PDFDocumentProxy, pageNumber: number) {
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1.2 })
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Could not create a preview canvas.")
  }

  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
  }).promise

  return {
    pageNumber,
    width: viewport.width,
    height: viewport.height,
    previewUrl: canvas.toDataURL("image/jpeg", 0.92),
  } satisfies PagePreview
}

export async function loadPdfDocument(
  bytes: Uint8Array,
  name: string
): Promise<LoadedDocument> {
  const sourceBytes = bytes.slice()
  const pdf = await getDocument({ data: sourceBytes.slice() }).promise
  const pages: PagePreview[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    pages.push(await renderPagePreview(pdf, pageNumber))
  }

  return { bytes: sourceBytes, name, pages }
}

export async function createSamplePdf() {
  const pdf = await PDFDocument.create()
  const bodyFont = await pdf.embedFont(StandardFonts.Helvetica)
  const titleFont = await pdf.embedFont(StandardFonts.HelveticaBold)

  const firstPage = pdf.addPage([612, 792])
  firstPage.drawRectangle({
    x: 34,
    y: 34,
    width: 544,
    height: 724,
    borderColor: rgb(0.73, 0.76, 0.8),
    borderWidth: 1,
  })
  firstPage.drawText("Travel Reimbursement Form", {
    x: 52,
    y: 722,
    size: 24,
    font: titleFont,
    color: rgb(0.13, 0.2, 0.23),
  })
  firstPage.drawText("Employee Name", {
    x: 54,
    y: 660,
    size: 11,
    font: bodyFont,
    color: rgb(0.38, 0.43, 0.46),
  })
  firstPage.drawLine({
    start: { x: 54, y: 648 },
    end: { x: 284, y: 648 },
    thickness: 1,
    color: rgb(0.73, 0.76, 0.8),
  })
  firstPage.drawText("Trip Purpose", {
    x: 314,
    y: 660,
    size: 11,
    font: bodyFont,
    color: rgb(0.38, 0.43, 0.46),
  })
  firstPage.drawLine({
    start: { x: 314, y: 648 },
    end: { x: 544, y: 648 },
    thickness: 1,
    color: rgb(0.73, 0.76, 0.8),
  })
  firstPage.drawText("Approver Signature", {
    x: 54,
    y: 198,
    size: 11,
    font: bodyFont,
    color: rgb(0.38, 0.43, 0.46),
  })
  firstPage.drawLine({
    start: { x: 54, y: 178 },
    end: { x: 280, y: 178 },
    thickness: 1,
    color: rgb(0.73, 0.76, 0.8),
  })

  const secondPage = pdf.addPage([612, 792])
  secondPage.drawText("Expense Notes", {
    x: 52,
    y: 718,
    size: 24,
    font: titleFont,
    color: rgb(0.13, 0.2, 0.23),
  })
  secondPage.drawRectangle({
    x: 52,
    y: 280,
    width: 508,
    height: 400,
    borderColor: rgb(0.73, 0.76, 0.8),
    borderWidth: 1,
  })
  secondPage.drawText("Use this page for notes, stamps, and approval text.", {
    x: 66,
    y: 650,
    size: 13,
    font: bodyFont,
    color: rgb(0.38, 0.43, 0.46),
  })

  return new Uint8Array(await pdf.save())
}

async function embedImage(pdf: PDFDocument, annotation: EditorAnnotation) {
  const bytes = dataUrlToUint8Array(annotation.dataUrl ?? "")
  const isPng = annotation.dataUrl?.startsWith("data:image/png") ?? false

  let image: PDFImage
  if (isPng) {
    image = await pdf.embedPng(bytes)
  } else {
    image = await pdf.embedJpg(bytes)
  }

  return image
}

export function validateAnnotations(annotations: EditorAnnotation[]) {
  const emptyText = annotations.find(
    (annotation) =>
      annotation.type === "text" && !(annotation.text ?? "").trim()
  )

  if (emptyText) {
    return "Text fields cannot be empty. Update or remove the highlighted text box before exporting."
  }

  const emptyImage = annotations.find(
    (annotation) =>
      (annotation.type === "image" || annotation.type === "signature") &&
      !annotation.dataUrl
  )

  if (emptyImage) {
    return "One of the image-based annotations is missing its source data."
  }

  return null
}

export async function exportAnnotatedPdf(
  sourceBytes: Uint8Array,
  annotations: EditorAnnotation[]
) {
  const pdf = await PDFDocument.load(sourceBytes)
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  for (const annotation of annotations) {
    const page = pdf.getPage(annotation.page - 1)
    const pageWidth = page.getWidth()
    const pageHeight = page.getHeight()
    const width = clamp(annotation.width, 0.04, 1) * pageWidth
    const height = clamp(annotation.height, 0.03, 1) * pageHeight
    const x = clamp(annotation.x, 0, 1) * pageWidth
    const y =
      pageHeight -
      clamp(annotation.y, 0, 1) * pageHeight -
      height

    if (annotation.type === "text") {
      const fontSize = clamp(annotation.fontSize ?? 18, 8, 40)
      const lines = (annotation.text ?? "").split(/\r?\n/)
      const lineHeight = fontSize * 1.2

      page.drawRectangle({
        x,
        y,
        width,
        height,
        borderColor: rgb(0.82, 0.85, 0.88),
        borderWidth: 1,
        color: rgb(1, 1, 1),
        opacity: 0.92,
      })

      lines.forEach((line, index) => {
        page.drawText(line, {
          x: x + 8,
          y: y + height - fontSize - 8 - lineHeight * index,
          size: fontSize,
          font,
          color: hexToRgb(annotation.color ?? "#152224"),
          maxWidth: Math.max(width - 16, 1),
        })
      })

      continue
    }

    const image = await embedImage(pdf, annotation)
    page.drawImage(image, {
      x,
      y,
      width,
      height,
      opacity: clamp(annotation.opacity ?? 1, 0.1, 1),
    })
  }

  const bytes = await pdf.save()
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer

  return new Blob([buffer], { type: "application/pdf" })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 0)
}
