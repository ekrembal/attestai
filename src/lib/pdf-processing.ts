import { jsPDF } from "jspdf"
import * as pdfjs from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

export type PdfProcessResult = {
  blob: Blob
  fileName: string
  originalSize: number
  outputSize: number
  passed: boolean
  message: string
}

type ProgressCallback = (value: number) => void

const PDF_VARIANTS = [
  { scale: 1.35, quality: 0.82 },
  { scale: 1.15, quality: 0.7 },
  { scale: 1, quality: 0.58 },
  { scale: 0.88, quality: 0.48 },
  { scale: 0.76, quality: 0.4 },
]

function getOrientation(width: number, height: number) {
  return width > height ? "landscape" : "portrait"
}

async function renderPdfVariant(
  data: Uint8Array,
  scale: number,
  quality: number,
  onProgress?: ProgressCallback
) {
  const pdfDocument = await pdfjs.getDocument({ data }).promise

  if (pdfDocument.numPages > 30) {
    throw new Error("Please use a PDF with 30 pages or fewer for browser-side compression.")
  }

  let pdf: jsPDF | null = null

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber)
    const viewport = page.getViewport({ scale })
    const canvas = window.document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(viewport.width))
    canvas.height = Math.max(1, Math.round(viewport.height))
    const context = canvas.getContext("2d")

    if (!context) {
      throw new Error("Canvas support is required for browser-side PDF processing.")
    }

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise

    const pageBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob: Blob | null) => {
          if (!blob) {
            reject(new Error("The browser could not export a PDF page image."))
            return
          }

          resolve(blob)
        },
        "image/jpeg",
        quality
      )
    })

    const pageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result)
          return
        }

        reject(new Error("The PDF page image could not be read back."))
      }
      reader.onerror = () =>
        reject(new Error("The PDF page image could not be read back."))
      reader.readAsDataURL(pageBlob)
    })

    const pageWidth = canvas.width
    const pageHeight = canvas.height
    const orientation = getOrientation(pageWidth, pageHeight)

    if (!pdf) {
      pdf = new jsPDF({
        orientation,
        unit: "pt",
        format: [pageWidth, pageHeight],
        compress: true,
      })
    } else {
      pdf.addPage([pageWidth, pageHeight], orientation)
    }

    pdf.addImage(pageDataUrl, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST")
    page.cleanup()
    onProgress?.(Math.round((pageNumber / pdfDocument.numPages) * 100))
  }

  if (!pdf) {
    throw new Error("This PDF appears to be empty.")
  }

  pdfDocument.cleanup()
  const blob = pdf.output("blob")
  return blob
}

function formatLimit(value: number) {
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(0)} KB`
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`
}

export async function compressPdfToTarget(
  file: File,
  targetBytes: number,
  onProgress?: ProgressCallback
): Promise<PdfProcessResult> {
  const data = new Uint8Array(await file.arrayBuffer())
  let bestBlob: Blob | null = null

  for (const variant of PDF_VARIANTS) {
    const blob = await renderPdfVariant(
      data,
      variant.scale,
      variant.quality,
      onProgress
    )

    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob
    }

    if (blob.size <= targetBytes) {
      return {
        blob,
        fileName: file.name,
        originalSize: file.size,
        outputSize: blob.size,
        passed: true,
        message: `Compressed PDF is ready and fits under ${formatLimit(targetBytes)}.`,
      }
    }
  }

  if (!bestBlob) {
    throw new Error("No PDF output could be produced.")
  }

  return {
    blob: bestBlob,
    fileName: file.name,
    originalSize: file.size,
    outputSize: bestBlob.size,
    passed: bestBlob.size <= targetBytes,
    message: `Best browser-side result is ${formatLimit(bestBlob.size)}. Complex PDFs may need a higher limit.`,
  }
}
